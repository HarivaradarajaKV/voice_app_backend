import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { DashboardController } from '../controllers/dashboard.controller';
import { InventoryController } from '../controllers/inventory.controller';
import { MenuController } from '../controllers/menu.controller';
import { OrdersController } from '../controllers/orders.controller';
import { KDSController } from '../controllers/kds.controller';
import { ProcurementController } from '../controllers/procurement.controller';
import { SuppliersController } from '../controllers/suppliers.controller';
import { ReceivingController } from '../controllers/receiving.controller';
import { InvoicesController } from '../controllers/invoices.controller';
import { ReconciliationController } from '../controllers/reconciliation.controller';
import { AnalyticsController } from '../controllers/analytics.controller';
import { ReportsController } from '../controllers/reports.controller';
import { AdminController } from '../controllers/admin.controller';
import { authenticateJWT, requireRole } from '../middleware/auth.middleware';
import { uploadInvoice } from '../middleware/upload.middleware';
import { RoleType } from '@prisma/client';

const router = Router();

// 1. Auth Routes
router.post('/auth/login', AuthController.login);
router.post('/auth/forgot-password', AuthController.forgotPassword);
router.get('/auth/profile', authenticateJWT, AuthController.getProfile);
router.put('/auth/profile', authenticateJWT, AuthController.updateProfile);

// 2. Dashboard
router.get('/dashboard', authenticateJWT, DashboardController.getDashboardMetrics);

// 3. Inventory & Units
router.get('/inventory/ingredients', authenticateJWT, InventoryController.getIngredients);
router.get('/inventory/ingredients/:id', authenticateJWT, InventoryController.getIngredientById);
router.post('/inventory/ingredients', authenticateJWT, InventoryController.createIngredient);
router.put('/inventory/ingredients/:id', authenticateJWT, InventoryController.updateIngredient);
router.post('/inventory/adjust', authenticateJWT, InventoryController.adjustStock);
router.post('/inventory/waste', authenticateJWT, InventoryController.recordWaste);
router.get('/inventory/transactions', authenticateJWT, InventoryController.getTransactions);
router.get('/inventory/waste-records', authenticateJWT, InventoryController.getWasteRecords);
router.get('/inventory/categories', authenticateJWT, InventoryController.getCategories);
router.get('/inventory/units', authenticateJWT, InventoryController.getUnits);

// 4. Menu & BOM Studio
router.get('/menu/items', authenticateJWT, MenuController.getMenuItems);
router.get('/menu/items/:id', authenticateJWT, MenuController.getMenuItemById);
router.post('/menu/items', authenticateJWT, MenuController.createMenuItem);
router.put('/menu/items/:id', authenticateJWT, MenuController.updateMenuItem);
router.post('/menu/recipes/bom', authenticateJWT, MenuController.saveRecipeBOM);
router.post('/menu/recipes/simulate-scaling', authenticateJWT, MenuController.simulatePortionScaling);
router.get('/menu/categories', authenticateJWT, MenuController.getMenuCategories);

// 5. Orders & KDS
router.get('/orders', authenticateJWT, OrdersController.getOrders);
router.get('/orders/:id', authenticateJWT, OrdersController.getOrderById);
router.post('/orders', authenticateJWT, OrdersController.createOrder);
router.put('/orders/:id/status', authenticateJWT, OrdersController.updateOrderStatus);

router.get('/kds/orders', authenticateJWT, KDSController.getKitchenOrders);
router.put('/kds/items/:id/status', authenticateJWT, KDSController.updateKitchenItemStatus);
router.get('/kds/stations', authenticateJWT, KDSController.getStations);

// 6. Procurement & Purchase Orders
router.get('/procurement/recommendations', authenticateJWT, ProcurementController.getRecommendations);
router.get('/procurement/forecast/:ingredientId', authenticateJWT, ProcurementController.getIngredientForecast);
router.get('/procurement/purchase-orders', authenticateJWT, ProcurementController.getPurchaseOrders);
router.get('/procurement/purchase-orders/:id', authenticateJWT, ProcurementController.getPurchaseOrderById);
router.post('/procurement/purchase-orders', authenticateJWT, ProcurementController.createPurchaseOrder);
router.post('/procurement/purchase-orders/:id/approve', authenticateJWT, ProcurementController.approvePurchaseOrder);
router.get('/procurement/purchase-orders/:id/whatsapp', authenticateJWT, ProcurementController.getWhatsAppMessage);

// 7. Suppliers & Supplier Portal
router.get('/suppliers', authenticateJWT, SuppliersController.getSuppliers);
router.get('/suppliers/:id', authenticateJWT, SuppliersController.getSupplierById);
router.post('/suppliers', authenticateJWT, SuppliersController.createSupplier);
router.post('/suppliers/portal/orders/:poId/confirm', authenticateJWT, SuppliersController.supplierConfirmPO);

// 8. Deliveries & Goods Receiving
router.get('/receiving/deliveries', authenticateJWT, ReceivingController.getDeliveries);
router.post('/receiving/process', authenticateJWT, ReceivingController.processReceiving);

// 9. Invoices & OCR Document Extraction
router.get('/invoices', authenticateJWT, InvoicesController.getInvoices);
router.get('/invoices/:id', authenticateJWT, InvoicesController.getInvoiceById);
router.post('/invoices/upload', authenticateJWT, uploadInvoice.single('document'), InvoicesController.uploadAndExtractInvoice);

// 10. PO vs Invoice Reconciliation
router.get('/reconciliation', authenticateJWT, ReconciliationController.getReconciliations);
router.get('/reconciliation/:id', authenticateJWT, ReconciliationController.getReconciliationById);
router.post('/reconciliation/run', authenticateJWT, ReconciliationController.runReconciliation);
router.post('/reconciliation/:id/approve', authenticateJWT, ReconciliationController.approveReconciliation);

// 11. Analytics & Reports
router.get('/analytics/overview', authenticateJWT, AnalyticsController.getOperationalAnalytics);
router.get('/reports/daily', authenticateJWT, ReportsController.getDailyReport);

import { VoiceController } from '../controllers/voice.controller';

// 12. Administration & System Settings
router.get('/admin/users', authenticateJWT, AdminController.getUsers);
router.post('/admin/users', authenticateJWT, AdminController.createUser);
router.get('/admin/branches', authenticateJWT, AdminController.getBranches);
router.post('/admin/branches', authenticateJWT, AdminController.createBranch);
router.get('/admin/audit-logs', authenticateJWT, AdminController.getAuditLogs);
router.get('/admin/notifications', authenticateJWT, AdminController.getNotifications);
router.put('/admin/notifications/:id/read', authenticateJWT, AdminController.markNotificationRead);

// 13. Voice Action Agent Routes
router.post('/voice/action', authenticateJWT, VoiceController.handleVoiceAction);
router.post('/voice/confirm', authenticateJWT, VoiceController.confirmPendingAction);
// 14. VAPI Tool-Call Webhook (no JWT — VAPI calls this from their servers)
import { VoiceAgentService } from '../services/voiceAgent.service';
router.post('/voice/vapi-webhook', async (req, res) => {
  try {
    const body = req.body;

    // VAPI sends tool calls wrapped in a "message" object
    const message = body?.message ?? body;
    if (!message || message.type !== 'tool-calls') {
      // Not a tool-call — return empty to satisfy VAPI
      return res.json({ results: [] });
    }

    const toolCallList: any[] = message.toolCallList ?? message.toolCalls ?? [];
    if (toolCallList.length === 0) {
      return res.json({ results: [] });
    }

    const results = await Promise.all(
      toolCallList.map(async (toolCall: any) => {
        const fnName: string = toolCall.function?.name ?? toolCall.name ?? '';
        const params: any = toolCall.function?.arguments
          ? (typeof toolCall.function.arguments === 'string'
              ? JSON.parse(toolCall.function.arguments)
              : toolCall.function.arguments)
          : (toolCall.parameters ?? toolCall.arguments ?? {});

        if (fnName === 'execute_voice_command') {
          const transcript: string = params.transcript ?? '';
          const sessionId: string = params.sessionId ?? `vapi_${Date.now()}`;
          const currentRoute: string = params.currentRoute ?? '/';
          // Metadata passed when starting the call
          const callMeta = message.call?.metadata ?? {};
          let branchId: string = callMeta.branchId ?? params.branchId ?? '';
          const userName: string = callMeta.userName ?? params.userName ?? 'Kishore Hegde';

          if (!branchId) {
            const firstBranch = await prisma.branch.findFirst();
            branchId = firstBranch?.id ?? '';
          }

          // Default role — VAPI calls are from authenticated restaurant staff
          const userId = `vapi_${sessionId}`;
          const userRole = 'MANAGER' as any;

          let toolResult: any = {
            spokenResponse: "I'm sorry, I couldn't process that.",
          };

          try {
            const result = await VoiceAgentService.processConversationalTurn(
              transcript,
              sessionId,
              userId,
              userRole,
              branchId,
              currentRoute,
              userName
            );
            toolResult = {
              spokenResponse: result.spokenResponse,
              uiNavigation: result.uiNavigation,
              confirmationRequired: result.confirmationRequired,
              actionResult: result.actionResult,
              detectedLanguage: result.detectedLanguage,
            };
          } catch (err) {
            console.error('[VAPI Webhook] VoiceAgentService error:', err);
          }

          return {
            toolCallId: toolCall.id,
            result: JSON.stringify(toolResult),
          };
        }

        // Unknown tool — return empty
        return { toolCallId: toolCall.id, result: JSON.stringify({ error: 'Unknown tool' }) };
      })
    );

    return res.json({ results });
  } catch (error) {
    console.error('[VAPI Webhook] Unhandled error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
