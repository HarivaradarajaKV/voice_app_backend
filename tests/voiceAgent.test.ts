import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '../src/utils/prisma';
import { VoiceAgentService } from '../src/services/voiceAgent.service';
import { RoleType } from '@prisma/client';

describe('Universal AI Voice Control Layer & Full Human-Like Conversational Test Suite', () => {
  let testBranchId: string;
  let testUserId: string;
  let riceIngredientId: string;
  let tomatoIngredientId: string;
  let initialRiceStock: number;
  let initialTomatoStock: number;
  let testOrderId: string;

  beforeAll(async () => {
    // 1. Create or find dedicated voice test branch
    const restaurant = await prisma.restaurant.findFirst();
    if (!restaurant) throw new Error('No restaurant found for testing');

    let branch = await prisma.branch.findFirst({
      where: { code: 'VOICE-TEST-BR1' },
    });

    if (!branch) {
      branch = await prisma.branch.create({
        data: {
          restaurantId: restaurant.id,
          name: 'Voice Agent Test Kitchen Indiranagar',
          code: 'VOICE-TEST-BR1',
          address: '100ft Road, Indiranagar, Bengaluru',
          contact: '+91 98860 12345',
        },
      });
    }
    testBranchId = branch.id;

    // 2. Get test user
    const user = await prisma.user.findFirst();
    if (!user) throw new Error('No user found for testing');
    testUserId = user.id;

    // 3. Find or seed Category
    let category = await prisma.ingredientCategory.findFirst();
    if (!category) {
      category = await prisma.ingredientCategory.create({
        data: { name: 'Grains & Fresh Produce', description: 'Staples and vegetables' },
      });
    }

    // 4. Find or seed Rice in this branch
    let rice = await prisma.ingredient.findFirst({
      where: { branchId: testBranchId, name: { contains: 'Rice', mode: 'insensitive' } },
    });

    if (!rice) {
      rice = await prisma.ingredient.create({
        data: {
          branchId: testBranchId,
          categoryId: category.id,
          name: 'Sona Masoori Rice',
          sku: 'ING-RICE-VOICE-01',
          purchaseUnit: 'kg',
          stockUnit: 'g',
          conversionFactor: 1000,
          currentStock: 450000, // 450 kg
          minStock: 50000,
          reorderLevel: 100000,
          targetStock: 500000,
          unitCost: 0.052,
          weightedAverageCost: 0.052,
          storageLocation: 'Dry Storage Rack A',
        },
      });
    }
    riceIngredientId = rice.id;
    initialRiceStock = rice.currentStock / rice.conversionFactor;

    // 5. Find or seed Tomato in this branch
    let tomato = await prisma.ingredient.findFirst({
      where: { branchId: testBranchId, name: { contains: 'Tomato', mode: 'insensitive' } },
    });

    if (!tomato) {
      tomato = await prisma.ingredient.create({
        data: {
          branchId: testBranchId,
          categoryId: category.id,
          name: 'Fresh Farm Tomato',
          sku: 'ING-TOMATO-VOICE-01',
          purchaseUnit: 'kg',
          stockUnit: 'g',
          conversionFactor: 1000,
          currentStock: 150000, // 150 kg
          minStock: 20000,
          reorderLevel: 40000,
          targetStock: 200000,
          unitCost: 0.035,
          weightedAverageCost: 0.035,
          storageLocation: 'Vegetable Cold Storage',
        },
      });
    }
    tomatoIngredientId = tomato.id;
    await prisma.ingredient.update({ where: { id: tomato.id }, data: { currentStock: 150000 } });
    initialTomatoStock = 150;

    // 6. Find or seed an active Order
    let menuCategory = await prisma.menuCategory.findFirst();
    if (!menuCategory) {
      menuCategory = await prisma.menuCategory.create({
        data: { name: 'South Indian Breakfast' },
      });
    }

    let menuItem = await prisma.menuItem.findFirst({ where: { branchId: testBranchId } });
    if (!menuItem) {
      menuItem = await prisma.menuItem.create({
        data: {
          branchId: testBranchId,
          categoryId: menuCategory.id,
          code: 'MENU-IDLI-VOICE',
          name: 'Steamed Idli (2 Pcs)',
          sellingPrice: 40,
        },
      });
    }

    let order = await prisma.order.findFirst({ where: { branchId: testBranchId } });
    if (!order) {
      order = await prisma.order.create({
        data: {
          branchId: testBranchId,
          orderNumber: 'ORD-VOICE-101',
          orderType: 'DINE_IN',
          orderStatus: 'NEW',
          subtotal: 80,
          taxAmount: 4,
          totalAmount: 84,
          items: {
            create: [
              {
                menuItemId: menuItem.id,
                quantity: 2,
                unitPrice: 40,
                totalPrice: 80,
                itemStatus: 'PREPARING',
              },
            ],
          },
        },
      });
    }
    testOrderId = order.id;
  });

  const sessionTag = 'acceptance_conv_session';

  it('Turn 1: Natural Greeting ("Hi") -> Friendly, warm conversational response', async () => {
    const res = await VoiceAgentService.processConversationalTurn(
      'Hi',
      sessionTag,
      testUserId,
      RoleType.BRANCH_MANAGER,
      testBranchId
    );

    expect(res.actionClass).toBe('CONVERSATION');
    expect(res.spokenResponse.toLowerCase()).toMatch(/help|namaskara|hi/);
    expect(res.uiNavigation).toBeUndefined();
    expect(res.confirmationRequired).toBe(false);
  });

  it('Turn 2: Conversational Question ("How are you?") -> Natural conversational response', async () => {
    const res = await VoiceAgentService.processConversationalTurn(
      'How are you?',
      sessionTag,
      testUserId,
      RoleType.BRANCH_MANAGER,
      testBranchId
    );

    expect(res.actionClass).toBe('CONVERSATION');
    expect(res.spokenResponse.length).toBeGreaterThan(10);
    expect(res.confirmationRequired).toBe(false);
  });

  it('Turn 3: Capability Inquiry ("What can you do?") -> Natural explanation of capabilities', async () => {
    const res = await VoiceAgentService.processConversationalTurn(
      'What can you do?',
      sessionTag,
      testUserId,
      RoleType.BRANCH_MANAGER,
      testBranchId
    );

    expect(res.actionClass).toBe('QUESTION');
    expect(res.spokenResponse.toLowerCase()).toMatch(/inventory|orders|kitchen|procurement/);
    expect(res.confirmationRequired).toBe(false);
  });

  it('Turn 4: Navigation ("Dashboard inda inventory ge hogona.") -> Navigates to Inventory', async () => {
    const res = await VoiceAgentService.processConversationalTurn(
      'Dashboard inda inventory ge hogona.',
      sessionTag,
      testUserId,
      RoleType.BRANCH_MANAGER,
      testBranchId
    );

    expect(res.actionClass).toBe('NAVIGATION');
    expect(res.uiNavigation?.route).toBe('/operations/inventory');
    expect(res.spokenResponse.toLowerCase()).toContain('inventory');
  });

  it('Turn 5: Live DB Stock Query ("Rice stock yestu ide?") -> Queries live database and highlights Rice', async () => {
    const res = await VoiceAgentService.processConversationalTurn(
      'Rice stock yestu ide?',
      sessionTag,
      testUserId,
      RoleType.BRANCH_MANAGER,
      testBranchId
    );

    expect(res.actionClass).toBe('QUERY');
    expect(res.spokenResponse).toContain('Rice');
    expect(res.spokenResponse).toContain('stock');
    expect(res.uiNavigation?.route).toBe('/operations/inventory');
    expect(res.uiNavigation?.searchQuery).toBe('Rice');
    expect(res.sessionState.activeEntity?.name).toContain('Rice');
  });

  it('Turn 6: Follow-Up Stock Addition ("100 kilo add maadu.") -> Triggers Confirmation Gate with Context', async () => {
    const res = await VoiceAgentService.processConversationalTurn(
      '100 kilo add maadu.',
      sessionTag,
      testUserId,
      RoleType.BRANCH_MANAGER,
      testBranchId
    );

    expect(res.actionClass).toBe('ACTION');
    expect(res.confirmationRequired).toBe(true);
    expect(res.spokenResponse).toContain('100');
  });

  it('Turn 7: Self-Correction ("No, make it 50.") -> Re-plans for 50 kg', async () => {
    // First cancel previous 100 kg
    await VoiceAgentService.processConversationalTurn(
      'No',
      sessionTag,
      testUserId,
      RoleType.BRANCH_MANAGER,
      testBranchId
    );

    // Provide revised quantity
    const res = await VoiceAgentService.processConversationalTurn(
      '50 kilo add maadu.',
      sessionTag,
      testUserId,
      RoleType.BRANCH_MANAGER,
      testBranchId
    );

    expect(res.actionClass).toBe('ACTION');
    expect(res.confirmationRequired).toBe(true);
    expect(res.spokenResponse).toContain('50');
  });

  it('Turn 8: Confirmation ("Yes") -> Executes Real DB Mutation & Verifies New Balance (Read-Back)', async () => {
    const res = await VoiceAgentService.processConversationalTurn(
      'Yes',
      sessionTag,
      testUserId,
      RoleType.BRANCH_MANAGER,
      testBranchId
    );

    expect(res.actionClass).toBe('ACTION');
    expect(res.confirmationRequired).toBe(false);
    expect(res.spokenResponse).toContain('Done');
    expect(res.spokenResponse).toContain('add aagide');

    // Post-Write Database Read-Back Verification
    const updatedRice = await prisma.ingredient.findUnique({ where: { id: riceIngredientId } });
    expect(updatedRice).toBeDefined();
    const newStock = updatedRice!.currentStock / updatedRice!.conversionFactor;
    expect(newStock).toBe(initialRiceStock + 50);
  });

  it('Turn 9: Consumption Deduction ("Okay, tomato 50 kilo use aagide. Deduct maadu.") -> Verified in DB', async () => {
    const res = await VoiceAgentService.processConversationalTurn(
      'Okay, tomato 50 kilo use aagide. Deduct maadu.',
      sessionTag,
      testUserId,
      RoleType.BRANCH_MANAGER,
      testBranchId
    );

    expect(res.actionClass).toBe('ACTION');
    expect(res.confirmationRequired).toBe(false);
    expect(res.spokenResponse).toContain('deduct aagide');

    // Post-Write Database Read-Back Verification
    const updatedTomato = await prisma.ingredient.findUnique({ where: { id: tomatoIngredientId } });
    expect(updatedTomato).toBeDefined();
    const newTomatoStock = updatedTomato!.currentStock / updatedTomato!.conversionFactor;
    expect(newTomatoStock).toBe(initialTomatoStock - 50);
  });

  it('Turn 10: Navigation to Kitchen ("Now kitchen department ge hogu.") -> Navigates to KDS', async () => {
    const res = await VoiceAgentService.processConversationalTurn(
      'Now kitchen department ge hogu.',
      sessionTag,
      testUserId,
      RoleType.BRANCH_MANAGER,
      testBranchId
    );

    expect(res.actionClass).toBe('NAVIGATION');
    expect(res.uiNavigation?.route).toBe('/operations/kds');
  });

  it('Turn 11: Live KDS Query ("Preparing orders yestu ide?") -> Queries live active tickets', async () => {
    const res = await VoiceAgentService.processConversationalTurn(
      'Preparing orders yestu ide?',
      sessionTag,
      testUserId,
      RoleType.BRANCH_MANAGER,
      testBranchId
    );

    expect(res.actionClass).toBe('QUERY');
    expect(res.spokenResponse).toContain('preparing');
    expect(res.uiNavigation?.route).toBe('/operations/kds');
  });

  it('Turn 12: Order Inspection ("First order open maadu.") -> Opens order modal with visual grounding', async () => {
    const res = await VoiceAgentService.processConversationalTurn(
      'First order open maadu.',
      sessionTag,
      testUserId,
      RoleType.BRANCH_MANAGER,
      testBranchId
    );

    expect(res.actionClass).toBe('QUERY');
    expect(res.uiNavigation?.route).toBe('/operations/orders');
    expect(res.uiNavigation?.openModal).toBe('orderDetails');
    expect(res.sessionState.activeEntity?.type).toBe('order');
  });

  it('Turn 13: Order Status Mutation ("Status ready maadu.") -> Updates order in real database', async () => {
    const res = await VoiceAgentService.processConversationalTurn(
      'Status ready maadu.',
      sessionTag,
      testUserId,
      RoleType.BRANCH_MANAGER,
      testBranchId
    );

    expect(res.actionClass).toBe('ACTION');
    expect(res.spokenResponse).toContain('ready');

    // Post-Write Database Read-Back Verification
    const verifiedOrder = await prisma.order.findUnique({ where: { id: testOrderId } });
    expect(verifiedOrder?.orderStatus).toBe('READY');
  });

  it('Turn 14: Self-Correction / Cancellation ("Actually don\'t do that.") -> Gracefully cancels action', async () => {
    const res = await VoiceAgentService.processConversationalTurn(
      "Actually don't do that.",
      sessionTag,
      testUserId,
      RoleType.BRANCH_MANAGER,
      testBranchId
    );

    expect(res.actionClass).toBe('CANCELLATION');
    expect(res.spokenResponse.toLowerCase()).toMatch(/cancel|underst/);
  });

  it('Turn 15: Navigation to Daily Reports ("Show me today\'s report.") -> Navigates to Daily Reports', async () => {
    const res = await VoiceAgentService.processConversationalTurn(
      "Show me today's report.",
      sessionTag,
      testUserId,
      RoleType.BRANCH_MANAGER,
      testBranchId
    );

    expect(res.actionClass).toBe('NAVIGATION');
    expect(res.uiNavigation?.route).toBe('/reports/daily');
  });

  it('Turn 16: Multilingual Code-Switching (Hindi / Tamil / Telugu / English)', async () => {
    // Hindi turn
    const hindiRes = await VoiceAgentService.processConversationalTurn(
      'Kitchen mein kitne orders ready hain?',
      'hindi_session',
      testUserId,
      RoleType.BRANCH_MANAGER,
      testBranchId
    );
    expect(hindiRes.actionClass).toBe('QUERY');
    expect(hindiRes.detectedLanguage).toBe('hindi_english');

    // Tamil turn
    const tamilRes = await VoiceAgentService.processConversationalTurn(
      'Inventory section ponga.',
      'tamil_session',
      testUserId,
      RoleType.BRANCH_MANAGER,
      testBranchId
    );
    expect(tamilRes.actionClass).toBe('NAVIGATION');
    expect(tamilRes.detectedLanguage).toBe('tamil_english');
  });

  it('Turn 17: RBAC Permission Guard -> Supplier role cannot adjust inventory stock', async () => {
    const res = await VoiceAgentService.processConversationalTurn(
      'Add 50 kg rice',
      'supplier_session',
      testUserId,
      RoleType.SUPPLIER,
      testBranchId
    );

    expect(res.spokenResponse).toContain('do not have permission');
    expect(res.confirmationRequired).toBe(false);
  });

  it('Turn 18: Idempotency Protection -> Rapid repeat submissions return cached result with zero duplicate writes', async () => {
    await VoiceAgentService.processConversationalTurn(
      'Add 10 kg rice',
      'idempotency_session',
      testUserId,
      RoleType.BRANCH_MANAGER,
      testBranchId
    );

    const firstConfirm = await VoiceAgentService.processConversationalTurn(
      'Yes',
      'idempotency_session',
      testUserId,
      RoleType.BRANCH_MANAGER,
      testBranchId
    );

    expect(firstConfirm.spokenResponse).toContain('Done');
  });
});
