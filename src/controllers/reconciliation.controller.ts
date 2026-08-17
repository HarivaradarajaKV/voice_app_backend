import { Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { ReconciliationService } from '../services/reconciliation.service';
import { AuditService } from '../services/audit.service';

export class ReconciliationController {
  static async getReconciliations(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const branchId = (req.query.branchId as string) || req.user?.branchId;

      const records = await prisma.reconciliationRecord.findMany({
        where: { branchId },
        include: {
          purchaseOrder: { include: { supplier: true, items: { include: { ingredient: true } } } },
          invoice: { include: { supplier: true, items: true } },
          receivingRecord: { include: { items: { include: { ingredient: true } } } },
          discrepancies: true,
          approvedByUser: { select: { id: true, name: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({ success: true, data: records });
    } catch (err) {
      next(err);
    }
  }

  static async getReconciliationById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const record = await prisma.reconciliationRecord.findUnique({
        where: { id },
        include: {
          purchaseOrder: { include: { supplier: true, items: { include: { ingredient: true } } } },
          invoice: { include: { supplier: true, items: true } },
          receivingRecord: { include: { items: { include: { ingredient: true } } } },
          discrepancies: true,
          approvedByUser: { select: { id: true, name: true, role: true } },
        },
      });

      if (!record) {
        res.status(404).json({ success: false, error: 'Reconciliation record not found' });
        return;
      }

      res.json({ success: true, data: record });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Run 3-Way Automated Reconciliation (PO vs Receiving vs Invoice)
   */
  static async runReconciliation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { purchaseOrderId, invoiceId, receivingRecordId } = req.body;

      if (!purchaseOrderId || !invoiceId) {
        res.status(400).json({ success: false, error: 'purchaseOrderId and invoiceId are required' });
        return;
      }

      const result = await ReconciliationService.reconcile(
        purchaseOrderId,
        invoiceId,
        receivingRecordId
      );

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Managerial Approval for Reconciliation and Stock Confirmation
   */
  static async approveReconciliation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { reviewNotes } = req.body;

      const result = await ReconciliationService.approveReconciliation(
        id,
        req.user?.id || 'admin',
        reviewNotes
      );

      await AuditService.log({
        branchId: result.branchId,
        userId: req.user?.id,
        action: 'RECONCILIATION_APPROVED',
        entity: 'ReconciliationRecord',
        entityId: id,
        newValue: `Reconciliation #${id} approved with notes: ${reviewNotes || 'Approved'}`,
        ipAddress: req.ip,
      });

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}
