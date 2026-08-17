import { Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { InventoryEngineService } from '../services/inventoryEngine.service';
import { AuditService } from '../services/audit.service';
import { DeliveryStatus, POStatus } from '@prisma/client';

export class ReceivingController {
  static async getDeliveries(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const branchId = (req.query.branchId as string) || req.user?.branchId;
      const status = req.query.status as DeliveryStatus;

      const where: any = { branchId };
      if (status) where.status = status;

      const deliveries = await prisma.delivery.findMany({
        where,
        include: {
          supplier: true,
          purchaseOrder: {
            include: {
              items: { include: { ingredient: true } },
            },
          },
          receivingRecords: {
            include: { items: true },
          },
        },
        orderBy: { expectedArrival: 'desc' },
      });

      res.json({ success: true, data: deliveries });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Complete Goods Receiving Inspection (Expected vs Received vs Damaged vs Rejected)
   */
  static async processReceiving(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { deliveryId, purchaseOrderId, notes, items, updateStockImmediately } = req.body;

      const po = await prisma.purchaseOrder.findUnique({
        where: { id: purchaseOrderId },
        include: { items: { include: { ingredient: true } } },
      });

      if (!po) {
        res.status(404).json({ success: false, error: 'Purchase Order not found' });
        return;
      }

      const count = await prisma.receivingRecord.count({ where: { branchId: po.branchId } });
      const receivingNumber = `RCV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(count + 1).padStart(2, '0')}`;

      const receivingItemsData = [];
      for (const item of items) {
        const expected = parseFloat(item.expectedQty) || 0;
        const received = parseFloat(item.receivedQty) || 0;
        const damaged = parseFloat(item.damagedQty) || 0;
        const rejected = parseFloat(item.rejectedQty) || 0;
        const accepted = Math.max(0, received - damaged - rejected);

        const poItem = po.items.find((pi) => pi.ingredientId === item.ingredientId);
        const unitCost = poItem ? poItem.unitPrice : 0;

        receivingItemsData.push({
          ingredientId: item.ingredientId,
          expectedQty: expected,
          receivedQty: received,
          damagedQty: damaged,
          rejectedQty: rejected,
          acceptedQty: accepted,
          unit: item.unit || 'kg',
          unitCost,
          batchNumber: item.batchNumber || `BATCH-${item.ingredientId.slice(-4)}-${Date.now().toString().slice(-4)}`,
          expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
        });

        // Update PO Item acceptedQty
        if (poItem) {
          await prisma.purchaseOrderItem.update({
            where: { id: poItem.id },
            data: {
              receivedQty: received,
              damagedQty: damaged,
              rejectedQty: rejected,
              acceptedQty: accepted,
            },
          });
        }
      }

      const receiving = await prisma.receivingRecord.create({
        data: {
          purchaseOrderId,
          deliveryId: deliveryId || null,
          branchId: po.branchId,
          receivingNumber,
          receivedByUserId: req.user?.id,
          receivedAt: new Date(),
          status: 'COMPLETED',
          notes,
          items: {
            create: receivingItemsData,
          },
        },
        include: {
          items: { include: { ingredient: true } },
        },
      });

      // Update Delivery status
      if (deliveryId) {
        await prisma.delivery.update({
          where: { id: deliveryId },
          data: { status: DeliveryStatus.RECEIVED, actualArrival: new Date() },
        });
      }

      // Update PO Status
      await prisma.purchaseOrder.update({
        where: { id: purchaseOrderId },
        data: { status: POStatus.RECEIVED },
      });

      // If immediate stock update requested (or when skipping separate invoice gate)
      if (updateStockImmediately) {
        await InventoryEngineService.receiveGoodsAndUpdateStock(receiving.id, req.user?.id);
      }

      await AuditService.log({
        branchId: po.branchId,
        userId: req.user?.id,
        action: 'GOODS_RECEIVED',
        entity: 'ReceivingRecord',
        entityId: receiving.id,
        newValue: `${receiving.receivingNumber} received for PO #${po.poNumber}`,
        ipAddress: req.ip,
      });

      res.status(201).json({ success: true, data: receiving });
    } catch (err) {
      next(err);
    }
  }
}
