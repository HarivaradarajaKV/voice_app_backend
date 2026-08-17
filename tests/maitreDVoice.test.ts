import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '../src/utils/prisma';
import { VoiceAgentService } from '../src/services/voiceAgent.service';
import { RoleType, OrderStatus } from '@prisma/client';

describe('maitreD Admin Voice Assistant — Customer Orders & Lifecycle Voice Control', () => {
  let testBranchId: string;
  let testUserId: string;
  let testAdminName = 'Arivardhan';
  let riceIngredientId: string;
  let uradDalIngredientId: string;
  let initialRiceStock: number;
  let initialUradDalStock: number;
  let testMenuItemId: string;
  let testOrderId: string;
  let testOrderNumber: string;

  beforeAll(async () => {
    // 1. Get or create test restaurant & branch
    const restaurant = await prisma.restaurant.findFirst();
    if (!restaurant) throw new Error('No restaurant found for testing');

    let branch = await prisma.branch.findFirst({
      where: { code: 'MAITRED-TEST-BR1' },
    });

    if (!branch) {
      branch = await prisma.branch.create({
        data: {
          restaurantId: restaurant.id,
          name: 'Data Udipi MaitreD Test Branch',
          code: 'MAITRED-TEST-BR1',
          address: 'MG Road, Bengaluru',
          contact: '+91 99887 76655',
        },
      });
    }
    testBranchId = branch.id;

    // 2. Get test user
    const user = await prisma.user.findFirst();
    if (!user) throw new Error('No user found for testing');
    testUserId = user.id;

    // 3. Category
    let category = await prisma.ingredientCategory.findFirst();
    if (!category) {
      category = await prisma.ingredientCategory.create({
        data: { name: 'Raw Staples', description: 'Grains & Pulses' },
      });
    }

    // 4. Seed Rice (Ingredient for BOM)
    let rice = await prisma.ingredient.findFirst({
      where: { branchId: testBranchId, name: { contains: 'Rice', mode: 'insensitive' } },
    });
    if (!rice) {
      rice = await prisma.ingredient.create({
        data: {
          branchId: testBranchId,
          categoryId: category.id,
          name: 'Sona Masoori Rice',
          sku: 'ING-RICE-MAITRED-01',
          purchaseUnit: 'kg',
          stockUnit: 'g',
          conversionFactor: 1000,
          currentStock: 200000, // 200 kg
          minStock: 20000,
          reorderLevel: 40000,
          targetStock: 250000,
          unitCost: 0.05,
          weightedAverageCost: 0.05,
        },
      });
    }
    riceIngredientId = rice.id;
    await prisma.ingredient.update({ where: { id: rice.id }, data: { currentStock: 200000 } });
    initialRiceStock = 200;

    // 5. Seed Urad Dal (Ingredient for BOM)
    let urad = await prisma.ingredient.findFirst({
      where: { branchId: testBranchId, name: { contains: 'Urad', mode: 'insensitive' } },
    });
    if (!urad) {
      urad = await prisma.ingredient.create({
        data: {
          branchId: testBranchId,
          categoryId: category.id,
          name: 'Urad Dal Gota',
          sku: 'ING-URAD-MAITRED-01',
          purchaseUnit: 'kg',
          stockUnit: 'g',
          conversionFactor: 1000,
          currentStock: 100000, // 100 kg
          minStock: 10000,
          reorderLevel: 20000,
          targetStock: 150000,
          unitCost: 0.12,
          weightedAverageCost: 0.12,
        },
      });
    }
    uradDalIngredientId = urad.id;
    await prisma.ingredient.update({ where: { id: urad.id }, data: { currentStock: 100000 } });
    initialUradDalStock = 100;

    // 6. Seed Menu Category & Menu Item (Steamed Idli)
    let menuCategory = await prisma.menuCategory.findFirst();
    if (!menuCategory) {
      menuCategory = await prisma.menuCategory.create({
        data: { name: 'South Indian Specialties' },
      });
    }

    let menuItem = await prisma.menuItem.findFirst({
      where: { branchId: testBranchId, name: { contains: 'Idli', mode: 'insensitive' } },
    });
    if (!menuItem) {
      menuItem = await prisma.menuItem.create({
        data: {
          branchId: testBranchId,
          categoryId: menuCategory.id,
          code: 'MENU-IDLI-MAITRED',
          name: 'Steamed Idli (2 Pcs)',
          sellingPrice: 50,
          taxRate: 5.0,
        },
      });
    }
    testMenuItemId = menuItem.id;

    // 7. Seed Recipe BOM for Idli (40g Rice + 10g Urad Dal per portion)
    let recipe = await prisma.recipe.findUnique({ where: { menuItemId: menuItem.id } });
    if (!recipe) {
      recipe = await prisma.recipe.create({
        data: {
          menuItemId: menuItem.id,
          name: 'Steamed Idli Standard BOM',
          standardPortion: 1.0,
          items: {
            create: [
              {
                ingredientId: rice.id,
                quantity: 40, // 40g
                unit: 'g',
              },
              {
                ingredientId: urad.id,
                quantity: 10, // 10g
                unit: 'g',
              },
            ],
          },
        },
      });
    }

    // 8. Clean up prior test orders for this test branch
    await prisma.kitchenOrderItem.deleteMany({ where: { order: { branchId: testBranchId } } });
    await prisma.orderItem.deleteMany({ where: { order: { branchId: testBranchId } } });
    await prisma.order.deleteMany({ where: { branchId: testBranchId } });

    // Seed Customer Order (Rahul - 2x Idli = ₹105)
    let order = await prisma.order.create({
      data: {
        branchId: testBranchId,
        orderNumber: 'ORD-1045',
        orderType: 'DINE_IN',
        tableNumber: 'T-04',
        customerName: 'Rahul Verma',
        customerPhone: '+91 98765 43210',
        orderStatus: OrderStatus.NEW,
        subtotal: 100,
        taxAmount: 5,
        totalAmount: 105,
        items: {
          create: [
            {
              menuItemId: menuItem.id,
              quantity: 2,
              unitPrice: 50,
              totalPrice: 100,
              itemStatus: 'NEW',
            },
          ],
        },
      },
    });
    testOrderId = order.id;
    testOrderNumber = order.orderNumber;
  });

  const sessionKey = 'maitred_admin_session_01';

  it('Step 1: Ambient Wake-Word Activation ("Hey maitreD") -> Responds with dynamic Admin Name', async () => {
    const res = await VoiceAgentService.processConversationalTurn(
      'Hey maitreD',
      sessionKey,
      testUserId,
      RoleType.BRANCH_MANAGER,
      testBranchId,
      '/dashboard',
      testAdminName
    );

    expect(res.actionClass).toBe('CONVERSATION');
    expect(res.spokenResponse).toContain(testAdminName);
    expect(res.spokenResponse.toLowerCase()).toMatch(/how may i help you|how can i help you/);
    expect(res.confirmationRequired).toBe(false);
  });

  it('Step 2: Navigation ("Go to customer orders.") -> Navigates to Customer Orders UI', async () => {
    const res = await VoiceAgentService.processConversationalTurn(
      'Go to customer orders.',
      sessionKey,
      testUserId,
      RoleType.BRANCH_MANAGER,
      testBranchId,
      '/dashboard',
      testAdminName
    );

    expect(res.actionClass).toBe('NAVIGATION');
    expect(res.uiNavigation?.route).toBe('/operations/orders');
    expect(res.spokenResponse).toContain('customer orders');
  });

  it('Step 3: Filter Pending Orders ("Show new orders.") -> Applies status filter', async () => {
    const res = await VoiceAgentService.processConversationalTurn(
      'Show new orders.',
      sessionKey,
      testUserId,
      RoleType.BRANCH_MANAGER,
      testBranchId,
      '/operations/orders',
      testAdminName
    );

    expect(res.actionClass).toBe('QUERY');
    expect(res.uiNavigation?.route).toBe('/operations/orders');
    expect(res.uiNavigation?.filter?.status).toBe('NEW');
  });

  it('Step 4: Order Inspection ("Open the first one.") -> Opens order details with visual grounding', async () => {
    const res = await VoiceAgentService.processConversationalTurn(
      'Open the first one.',
      sessionKey,
      testUserId,
      RoleType.BRANCH_MANAGER,
      testBranchId,
      '/operations/orders',
      testAdminName
    );

    expect(res.actionClass).toBe('QUERY');
    expect(res.uiNavigation?.openModal).toBe('orderDetails');
    expect(res.sessionState.activeEntity?.type).toBe('order');
    expect(res.spokenResponse.toLowerCase()).toContain('first');
  });

  it(
    'Step 5: Order Acceptance & Atomic BOM Inventory Deduction ("Accept this order.") -> Updates DB & Deducts Stock',
    async () => {
      const res = await VoiceAgentService.processConversationalTurn(
        'Accept this order.',
        sessionKey,
        testUserId,
        RoleType.BRANCH_MANAGER,
        testBranchId,
        '/operations/orders',
        testAdminName
      );

      expect(res.actionClass).toBe('ACTION');
      expect(res.spokenResponse.toLowerCase()).toMatch(/accept|accepted/);
      expect(res.spokenResponse).toContain(testOrderNumber);

      // Post-Write Database Read-Back Verification
      const verifiedOrder = await prisma.order.findUnique({ where: { id: testOrderId } });
      expect(verifiedOrder?.orderStatus).toBe(OrderStatus.ACCEPTED);

      // Post-Write BOM Stock Deduction Verification (2 portions = 80g Rice + 20g Urad Dal)
      const verifiedRice = await prisma.ingredient.findUnique({ where: { id: riceIngredientId } });
      const verifiedUrad = await prisma.ingredient.findUnique({ where: { id: uradDalIngredientId } });

      expect(verifiedRice!.currentStock).toBe(200000 - 80);
      expect(verifiedUrad!.currentStock).toBe(100000 - 20);
    },
    15000
  );

  it('Step 6: Ready to Serve ("Food is ready. Make it ready to serve.") -> Updates status to READY', async () => {
    const res = await VoiceAgentService.processConversationalTurn(
      'Food is ready. Make it ready to serve.',
      sessionKey,
      testUserId,
      RoleType.BRANCH_MANAGER,
      testBranchId,
      '/operations/orders',
      testAdminName
    );

    expect(res.actionClass).toBe('ACTION');
    expect(res.spokenResponse.toLowerCase()).toContain('ready to serve');

    // Post-Write Database Read-Back Verification
    const verifiedOrder = await prisma.order.findUnique({ where: { id: testOrderId } });
    expect(verifiedOrder?.orderStatus).toBe(OrderStatus.READY);
  });

  it('Step 7: State Machine Validation -> Blocks invalid serve transition for unready orders', async () => {
    // Create a new unready order
    const unreadyOrder = await prisma.order.create({
      data: {
        branchId: testBranchId,
        orderNumber: 'ORD-UNREADY-99',
        orderType: 'DINE_IN',
        orderStatus: OrderStatus.NEW,
        subtotal: 50,
        taxAmount: 2.5,
        totalAmount: 52.5,
      },
    });

    // Try to mark served directly
    const res = await VoiceAgentService.processConversationalTurn(
      `Mark order ${unreadyOrder.orderNumber} served`,
      'new_temp_session',
      testUserId,
      RoleType.BRANCH_MANAGER,
      testBranchId,
      '/operations/orders',
      testAdminName
    );

    expect(res.spokenResponse).toContain("isn't ready to be served yet");

    // Verify DB was NOT updated
    const verified = await prisma.order.findUnique({ where: { id: unreadyOrder.id } });
    expect(verified?.orderStatus).toBe(OrderStatus.NEW);
  });

  it('Step 8: Status Reversion ("Actually move it back to preparing.") -> Valid reversal to PREPARING', async () => {
    const res = await VoiceAgentService.processConversationalTurn(
      'Actually move it back to preparing.',
      sessionKey,
      testUserId,
      RoleType.BRANCH_MANAGER,
      testBranchId,
      '/operations/orders',
      testAdminName
    );

    expect(res.actionClass).toBe('ACTION');
    expect(res.spokenResponse.toLowerCase()).toContain('preparing');

    // Post-Write Database Read-Back Verification
    const verifiedOrder = await prisma.order.findUnique({ where: { id: testOrderId } });
    expect(verifiedOrder?.orderStatus).toBe(OrderStatus.PREPARING);
  });

  it('Step 9: Contextual Undo ("Undo that.") -> Reverts last status change', async () => {
    // Mark it ready first
    await VoiceAgentService.processConversationalTurn(
      'Mark this order ready',
      sessionKey,
      testUserId,
      RoleType.BRANCH_MANAGER,
      testBranchId,
      '/operations/orders',
      testAdminName
    );

    // Then undo
    const res = await VoiceAgentService.processConversationalTurn(
      'Undo that.',
      sessionKey,
      testUserId,
      RoleType.BRANCH_MANAGER,
      testBranchId,
      '/operations/orders',
      testAdminName
    );

    expect(res.actionClass).toBe('ACTION');
    expect(res.spokenResponse.toLowerCase()).toContain('previous status');

    const verifiedOrder = await prisma.order.findUnique({ where: { id: testOrderId } });
    expect(verifiedOrder?.orderStatus).toBe(OrderStatus.PREPARING);
  });

  it('Step 10: Order Q&A ("What did they order?") -> Live order item details', async () => {
    const res = await VoiceAgentService.processConversationalTurn(
      'What did they order?',
      sessionKey,
      testUserId,
      RoleType.BRANCH_MANAGER,
      testBranchId,
      '/operations/orders',
      testAdminName
    );

    expect(res.actionClass).toBe('QUERY');
    expect(res.spokenResponse).toContain('Idli');
    expect(res.spokenResponse).toContain('105');
  });

  it('Step 11: Order Search by Customer Name ("Show orders for Rahul.") -> Finds and highlights order', async () => {
    const res = await VoiceAgentService.processConversationalTurn(
      'Show orders for Rahul.',
      sessionKey,
      testUserId,
      RoleType.BRANCH_MANAGER,
      testBranchId,
      '/operations/orders',
      testAdminName
    );

    expect(res.actionClass).toBe('QUERY');
    expect(res.spokenResponse).toContain('Rahul');
    expect(res.uiNavigation?.highlightId).toBe(testOrderId);
  });

  it('Step 12: Multilingual Variations (Kannada / Hindi / Tamil / Telugu)', async () => {
    // Kannada
    const knRes = await VoiceAgentService.processConversationalTurn(
      'Customer order section ge hogu.',
      'kn_session',
      testUserId,
      RoleType.BRANCH_MANAGER,
      testBranchId,
      '/dashboard',
      testAdminName
    );
    expect(knRes.actionClass).toBe('NAVIGATION');
    expect(knRes.detectedLanguage).toBe('kannada_english');

    // Hindi
    const hiRes = await VoiceAgentService.processConversationalTurn(
      'Is order ko accept karo',
      'hi_session',
      testUserId,
      RoleType.BRANCH_MANAGER,
      testBranchId,
      '/operations/orders',
      testAdminName
    );
    expect(hiRes.actionClass).toBe('ACTION');
    expect(hiRes.detectedLanguage).toBe('hindi_english');
  });

  it('Step 13: Polite Closing ("Thank you.") -> Responds with Admin Name and closes session', async () => {
    const res = await VoiceAgentService.processConversationalTurn(
      'Thank you.',
      sessionKey,
      testUserId,
      RoleType.BRANCH_MANAGER,
      testBranchId,
      '/operations/orders',
      testAdminName
    );

    expect(res.actionClass).toBe('CONVERSATION');
    expect(res.spokenResponse).toContain(testAdminName);
    expect(res.spokenResponse.toLowerCase()).toMatch(/welcome|great day|whenever you need me/);
  });

  it('Step 14: Wake-Word Reactivation ("Hey maitreD.") -> Activates fresh session', async () => {
    const res = await VoiceAgentService.processConversationalTurn(
      'Hey maitreD.',
      sessionKey,
      testUserId,
      RoleType.BRANCH_MANAGER,
      testBranchId,
      '/operations/orders',
      testAdminName
    );

    expect(res.actionClass).toBe('CONVERSATION');
    expect(res.spokenResponse).toContain(testAdminName);
  });
});
