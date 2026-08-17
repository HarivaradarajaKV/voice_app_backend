import { Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { AuditService } from '../services/audit.service';
import { POStatus, DeliveryStatus } from '@prisma/client';

export class SuppliersController {
  static async getSuppliers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const suppliers = await prisma.supplier.findMany({
        include: {
          supplierIngredients: {
            include: { ingredient: true },
          },
          _count: {
            select: { purchaseOrders: true, deliveries: true },
          },
        },
        orderBy: { name: 'asc' },
      });

      res.json({ success: true, data: suppliers });
    } catch (err) {
      next(err);
    }
  }

  static async getSupplierById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const supplier = await prisma.supplier.findUnique({
        where: { id },
        include: {
          supplierIngredients: { include: { ingredient: true } },
          purchaseOrders: { orderBy: { createdAt: 'desc' }, take: 10 },
          deliveries: { orderBy: { createdAt: 'desc' }, take: 10 },
        },
      });

      if (!supplier) {
        res.status(404).json({ success: false, error: 'Supplier not found' });
        return;
      }

      res.json({ success: true, data: supplier });
    } catch (err) {
      next(err);
    }
  }

  static async createSupplier(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const {
        name,
        contactPerson,
        phone,
        whatsappNumber,
        email,
        address,
        gstNumber,
        paymentTerms,
        deliverySchedule,
        leadTimeDays,
      } = req.body;

      const supplier = await prisma.supplier.create({
        data: {
          name,
          contactPerson,
          phone,
          whatsappNumber: whatsappNumber || phone,
          email,
          address,
          gstNumber,
          paymentTerms: paymentTerms || 'Net 15',
          deliverySchedule: deliverySchedule || 'Daily Morning',
          leadTimeDays: parseInt(leadTimeDays, 10) || 1,
        },
      });

      await AuditService.log({
        userId: req.user?.id,
        action: 'SUPPLIER_CREATED',
        entity: 'Supplier',
        entityId: supplier.id,
        newValue: `${supplier.name} created with lead time ${supplier.leadTimeDays}d`,
        ipAddress: req.ip,
      });

      res.status(201).json({ success: true, data: supplier });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Supplier Portal: Supplier confirms PO with optional modifications or scheduled delivery date
   */
  static async supplierConfirmPO(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { poId } = req.params;
      const { status, confirmedDeliveryDate, supplierNotes, modifications } = req.body;

      const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
      if (!po) {
        res.status(404).json({ success: false, error: 'Purchase Order not found' });
        return;
      }

      const confirmation = await prisma.supplierConfirmation.create({
        data: {
          purchaseOrderId: poId,
          supplierId: po.supplierId,
          status: status || 'CONFIRMED',
          confirmedDeliveryDate: confirmedDeliveryDate ? new Date(confirmedDeliveryDate) : po.expectedDeliveryDate,
          supplierNotes,
          modificationsJson: modifications ? JSON.stringify(modifications) : null,
        },
      });

      // Update PO Status to CONFIRMED
      await prisma.purchaseOrder.update({
        where: { id: poId },
        data: { status: POStatus.CONFIRMED },
      });

      // Automatically initialize Delivery record
      const delivery = await prisma.delivery.create({
        data: {
          purchaseOrderId: poId,
          supplierId: po.supplierId,
          branchId: po.branchId,
          dispatchDate: new Date(),
          expectedArrival: confirmedDeliveryDate ? new Date(confirmedDeliveryDate) : po.expectedDeliveryDate,
          status: DeliveryStatus.CONFIRMED,
          trackingNotes: supplierNotes || 'Supplier confirmed order for scheduled delivery',
        },
      });

      // Send In-App notification to restaurant manager
      await prisma.notification.create({
        data: {
          branchId: po.branchId,
          title: `Supplier Confirmed PO #${po.poNumber}`,
          message: `Supplier has confirmed delivery scheduled for ${new Date(delivery.expectedArrival).toLocaleDateString('en-IN')}.`,
          type: 'PO_UPDATE',
          severity: 'NORMAL',
          link: `/procurement/purchase-orders`,
        },
      });

      res.json({ success: true, data: { confirmation, delivery } });
    } catch (err) {
      next(err);
    }
  }
}
