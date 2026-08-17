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
import { prisma } from '../utils/prisma';

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
// 14. VAPI Tool-Call Webhook (handles both direct apiRequest & wrapped tool-calls payloads)
import { VoiceAgentService } from '../services/voiceAgent.service';
router.post('/voice/vapi-webhook', async (req, res) => {
  try {
    const body = req.body || {};

    // Determine if payload is direct apiRequest { transcript: "..." } or wrapped { message: { type: 'tool-calls', ... } }
    const message = body.message || body;
    const isToolCallsWrapped = message?.type === 'tool-calls' || Array.isArray(message?.toolCallList) || Array.isArray(message?.toolCalls);

    // Get branch context
    let branchId = body.branchId || message?.call?.metadata?.branchId || '';
    if (!branchId) {
      const firstBranch = await prisma.branch.findFirst();
      branchId = firstBranch?.id || '';
    }

    const userName = body.userName || message?.call?.metadata?.userName || 'Kishore Hegde';
    const currentRoute = body.currentRoute || message?.call?.metadata?.currentRoute || '/';
    const userRole = 'MANAGER' as any;

    if (isToolCallsWrapped) {
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

          let transcript: string =
            params.transcript ||
            params.text ||
            params.command ||
            params.query ||
            params.instruction ||
            params.input ||
            params.speech ||
            '';

          if (!transcript) {
            if (params.orderNumber && params.newStatus) {
              transcript = `Change order ${params.orderNumber} to ${params.newStatus}`;
            } else if (params.page) {
              transcript = `Go to ${params.page}${params.section ? ' ' + params.section : ''}`;
            } else if (params.status) {
              transcript = `Show ${params.status} orders`;
            } else if (params.item) {
              transcript = `Check inventory for ${params.item}`;
            } else if (params.period) {
              transcript = `Show ${params.period} sales`;
            }
          }

          const sessionId: string = params.sessionId || `vapi_${Date.now()}`;
          const userId = `vapi_${sessionId}`;

          let toolResult: any = { spokenResponse: "I've processed your request." };
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
            console.error('[VAPI Webhook] Execution error:', err);
          }

          return {
            toolCallId: toolCall.id,
            result: JSON.stringify(toolResult),
          };
        })
      );

      return res.json({ results });
    }

    // Direct apiRequest payload format: { transcript: "..." }
    let transcript: string =
      body.transcript ||
      body.text ||
      body.command ||
      body.query ||
      body.instruction ||
      body.body?.transcript ||
      body.body?.text ||
      body.parameters?.transcript ||
      body.parameters?.text ||
      body.arguments?.transcript ||
      message?.transcript ||
      message?.parameters?.transcript ||
      '';

    if (!transcript) {
      const p = body.body || body.parameters || body;
      if (p.orderNumber && p.newStatus) {
        transcript = `Change order ${p.orderNumber} to ${p.newStatus}`;
      } else if (p.page) {
        transcript = `Go to ${p.page}${p.section ? ' ' + p.section : ''}`;
      } else if (p.status) {
        transcript = `Show ${p.status} orders`;
      } else if (p.item) {
        transcript = `Check inventory for ${p.item}`;
      } else if (p.period) {
        transcript = `Show ${p.period} sales`;
      }
    }
    const sessionId = body.sessionId || `vapi_${Date.now()}`;
    const userId = `vapi_${sessionId}`;

    const result = await VoiceAgentService.processConversationalTurn(
      transcript,
      sessionId,
      userId,
      userRole,
      branchId,
      currentRoute,
      userName
    );

    const payload = {
      spokenResponse: result.spokenResponse,
      displayTranscript: result.displayTranscript,
      actionClass: result.actionClass,
      detectedLanguage: result.detectedLanguage,
      confirmationRequired: result.confirmationRequired,
      uiNavigation: result.uiNavigation,
      actionResult: result.actionResult,
      // Also provide results array for compatibility
      results: [
        {
          result: JSON.stringify({
            spokenResponse: result.spokenResponse,
            uiNavigation: result.uiNavigation,
            actionResult: result.actionResult,
          }),
        },
      ],
    };

    return res.json(payload);
  } catch (error) {
    console.error('[VAPI Webhook] Unhandled error:', error);
    return res.status(500).json({
      spokenResponse: "I encountered an error connecting to the restaurant system.",
      error: 'Internal server error',
    });
  }
});

// ─── SARVAM AI SPEECH SERVICES (Saaras v3 & Bulbul v3) ────────────────────────
import { SarvamVoiceService } from '../services/sarvamVoice.service';

/**
 * Synthesizes speech using Sarvam Bulbul v3
 */
router.post('/voice/sarvam-tts', async (req, res) => {
  try {
    const { text, language = 'kannada_english' } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Text is required for TTS synthesis' });
    }

    const ttsResult = await SarvamVoiceService.synthesizeSpeechBulbulV3(text, language);
    return res.json({
      success: true,
      audioBase64: ttsResult.audioBase64,
      format: ttsResult.format,
    });
  } catch (err: any) {
    console.error('[Sarvam TTS Route] Error:', err);
    return res.status(500).json({ error: err.message || 'TTS synthesis failed' });
  }
});

/**
 * Processes a voice command through VoiceAgentService and returns Bulbul v3 speech audio
 */
router.post('/voice/sarvam-command', async (req, res) => {
  try {
    const {
      transcript,
      sessionId = `sarvam_${Date.now()}`,
      branchId = 'cmsva145f000gitlp27vm05f5',
      userId = 'usr_manager_01',
      userRole = 'MANAGER',
      userName = 'Manager',
      currentRoute = '/',
    } = req.body;

    if (!transcript) {
      return res.status(400).json({ error: 'Transcript is required' });
    }

    const result = await VoiceAgentService.processConversationalTurn(
      transcript,
      sessionId,
      userId,
      userRole as any,
      branchId,
      currentRoute,
      userName
    );

    const detectedLanguage = result.detectedLanguage || 'kannada_english';
    const ttsResult = await SarvamVoiceService.synthesizeSpeechBulbulV3(
      result.spokenResponse,
      detectedLanguage
    );

    return res.json({
      success: true,
      transcript,
      detectedLanguage,
      intent: result.actionClass,
      uiNavigation: result.uiNavigation,
      actionResult: result.actionResult,
      confirmationRequired: result.confirmationRequired,
      responseText: result.spokenResponse,
      responseLanguage: detectedLanguage,
      audioBase64: ttsResult.audioBase64,
      audioFormat: ttsResult.format,
    });
  } catch (err: any) {
    console.error('[Sarvam Command Route] Error:', err);
    return res.status(500).json({ error: err.message || 'Command processing failed' });
  }
});

export default router;
