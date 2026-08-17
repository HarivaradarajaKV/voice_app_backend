import { Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { PurchaseRecommendationService } from '../services/recommendation.service';
import { DemandForecastingService } from '../services/forecasting.service';
import { WhatsAppProcurementService } from '../services/whatsapp.service';
import { AuditService } from '../services/audit.service';
import { POStatus, RoleType } from '@prisma/client';

export class ProcurementController {
  /**
   * Daily Stock Analysis & Deterministic Purchase Recommendations
   */
  static async getRecommendations(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const branchId = (req.query.branchId as string) || req.user?.branchId;
      if (!branchId) {
        res.status(400).json({ success: false, error: 'Branch ID is required' });
        return;
      }

      const result = await PurchaseRecommendationService.generateRecommendations(branchId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Ingredient Demand Forecast Breakdown
   */
  static async getIngredientForecast(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { ingredientId } = req.params;
      const branchId = (req.query.branchId as string) || req.user?.branchId;

      const forecast = await DemandForecastingService.getForecast(branchId!, ingredientId);
      res.json({ success: true, data: forecast });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Purchase Orders List
   */
  static async getPurchaseOrders(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const branchId = (req.query.branchId as string) || req.user?.branchId;
      const status = req.query.status as POStatus;
      const supplierId = req.query.supplierId as string;

      const where: any = { branchId };
      if (status) where.status = status;
      if (supplierId) where.supplierId = supplierId;

      const pos = await prisma.purchaseOrder.findMany({
        where,
        include: {
          supplier: true,
          items: { include: { ingredient: true } },
          confirmations: { orderBy: { confirmedAt: 'desc' } },
          deliveries: true,
          createdByUser: { select: { id: true, name: true, role: true } },
          approvedByUser: { select: { id: true, name: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({ success: true, data: pos });
    } catch (err) {
      next(err);
    }
  }

  static async getPurchaseOrderById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const po = await prisma.purchaseOrder.findUnique({
        where: { id },
        include: {
          supplier: true,
          branch: { include: { restaurant: true } },
          items: { include: { ingredient: true } },
          confirmations: { orderBy: { confirmedAt: 'desc' } },
          deliveries: { include: { receivingRecords: true } },
          invoices: true,
          reconciliations: { include: { discrepancies: true } },
          createdByUser: { select: { id: true, name: true, role: true } },
          approvedByUser: { select: { id: true, name: true, role: true } },
        },
      });

      if (!po) {
        res.status(404).json({ success: false, error: 'Purchase Order not found' });
        return;
      }

      res.json({ success: true, data: po });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Create PO (from approved recommendations or manual entry)
   */
  static async createPurchaseOrder(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const branchId = req.body.branchId || req.user?.branchId;
      const { supplierId, expectedDeliveryDate, notes, items } = req.body;

      if (!supplierId || !items || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({ success: false, error: 'Supplier and items are required' });
        return;
      }

      const count = await prisma.purchaseOrder.count({ where: { branchId } });
      const poNumber = `PO-2026-${String(count + 1).padStart(4, '0')}`;

      let subtotal = 0;
      const preparedItems = [];

      for (const item of items) {
        const qty = parseFloat(item.quantity);
        const unitPrice = parseFloat(item.unitPrice);
        const lineTotal = Math.round(qty * unitPrice * 100) / 100;
        subtotal += lineTotal;

        preparedItems.push({
          ingredientId: item.ingredientId,
          quantity: qty,
          unit: item.unit,
          unitPrice,
          totalPrice: lineTotal,
        });
      }

      const taxAmount = Math.round(subtotal * 0.05 * 100) / 100;
      const totalAmount = subtotal + taxAmount;

      const po = await prisma.purchaseOrder.create({
        data: {
          poNumber,
          branchId,
          supplierId,
          expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : new Date(Date.now() + 24 * 60 * 60 * 1000),
          status: POStatus.DRAFT,
          subtotal,
          taxAmount,
          totalAmount,
          notes,
          createdByUserId: req.user?.id,
          items: {
            create: preparedItems,
          },
        },
        include: {
          supplier: true,
          items: { include: { ingredient: true } },
        },
      });

      // Generate WhatsApp procurement message payload
      await WhatsAppProcurementService.generatePOMessage(po.id);

      await AuditService.log({
        branchId,
        userId: req.user?.id,
        action: 'PO_CREATED',
        entity: 'PurchaseOrder',
        entityId: po.id,
        newValue: `${po.poNumber} created for ${po.supplier.name} (₹${po.totalAmount})`,
        ipAddress: req.ip,
      });

      res.status(201).json({ success: true, data: po });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Managerial Approval for PO
   */
  static async approvePurchaseOrder(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const updated = await prisma.purchaseOrder.update({
        where: { id },
        data: {
          status: POStatus.PENDING_APPROVAL ? POStatus.SENT : POStatus.SENT,
          approvedByUserId: req.user?.id,
        },
        include: { supplier: true },
      });

      await AuditService.log({
        branchId: updated.branchId,
        userId: req.user?.id,
        action: 'PO_APPROVED',
        entity: 'PurchaseOrder',
        entityId: id,
        newValue: `PO #${updated.poNumber} approved and dispatched to supplier`,
        ipAddress: req.ip,
      });

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Generate or Fetch WhatsApp PO Message Deep Link
   */
  static async getWhatsAppMessage(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await WhatsAppProcurementService.generatePOMessage(id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}
