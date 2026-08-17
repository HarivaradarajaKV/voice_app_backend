import { prisma } from '../utils/prisma';
import { ReconciliationStatus, DiscrepancyType } from '@prisma/client';
import { InventoryEngineService } from './inventoryEngine.service';

export interface DiscrepancyItemDTO {
  discrepancyType: DiscrepancyType;
  itemName: string;
  poValue: string;
  invoiceValue: string;
  variance: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  notes: string;
}

export class ReconciliationService {
  /**
   * Run automated 3-way reconciliation between PO, Goods Receiving Record, and Invoice
   */
  static async reconcile(
    purchaseOrderId: string,
    invoiceId: string,
    receivingRecordId?: string
  ) {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      include: {
        supplier: true,
        items: { include: { ingredient: true } },
      },
    });

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        supplier: true,
        items: true,
      },
    });

    if (!po || !invoice) throw new Error('Purchase order or Invoice not found');

    const discrepancies: DiscrepancyItemDTO[] = [];
    let totalVariance = 0;

    // 1. Supplier Mismatch Check
    if (po.supplierId !== invoice.supplierId) {
      discrepancies.push({
        discrepancyType: DiscrepancyType.SUPPLIER_MISMATCH,
        itemName: 'Supplier Entity',
        poValue: po.supplier.name,
        invoiceValue: invoice.supplier.name,
        variance: 0,
        severity: 'HIGH',
        notes: `PO is linked to ${po.supplier.name} but invoice was billed by ${invoice.supplier.name}`,
      });
    }

    // 2. Line Items Cross-Examination (PO vs Invoice)
    const poItemMap = new Map(po.items.map((i) => [i.ingredientId, i]));
    const matchedPOIngredientIds = new Set<string>();

    for (const invItem of invoice.items) {
      if (!invItem.ingredientId) {
        discrepancies.push({
          discrepancyType: DiscrepancyType.UNKNOWN_ITEM,
          itemName: invItem.itemName,
          poValue: 'Not in PO',
          invoiceValue: `${invItem.quantity} ${invItem.unit} @ ₹${invItem.unitPrice}`,
          variance: invItem.totalPrice,
          severity: 'HIGH',
          notes: 'Line item present in invoice but absent from original PO specification.',
        });
        totalVariance += invItem.totalPrice;
        continue;
      }

      const poItem = poItemMap.get(invItem.ingredientId);
      if (!poItem) {
        discrepancies.push({
          discrepancyType: DiscrepancyType.UNKNOWN_ITEM,
          itemName: invItem.itemName,
          poValue: 'Not in PO',
          invoiceValue: `${invItem.quantity} ${invItem.unit} @ ₹${invItem.unitPrice}`,
          variance: invItem.totalPrice,
          severity: 'HIGH',
          notes: 'Item not in PO items list.',
        });
        totalVariance += invItem.totalPrice;
        continue;
      }

      matchedPOIngredientIds.add(poItem.ingredientId);

      // Quantity Comparison
      if (Math.abs(poItem.quantity - invItem.quantity) > 0.001) {
        const qtyDiff = invItem.quantity - poItem.quantity;
        const severity = Math.abs(qtyDiff) > poItem.quantity * 0.1 ? 'HIGH' : 'MEDIUM';
        discrepancies.push({
          discrepancyType: DiscrepancyType.QUANTITY_MISMATCH,
          itemName: poItem.ingredient.name,
          poValue: `${poItem.quantity} ${poItem.unit}`,
          invoiceValue: `${invItem.quantity} ${invItem.unit}`,
          variance: qtyDiff,
          severity,
          notes: `Quantity difference of ${qtyDiff > 0 ? '+' : ''}${qtyDiff} ${poItem.unit}`,
        });
        totalVariance += Math.abs(qtyDiff * invItem.unitPrice);
      }

      // Unit Price Comparison
      if (Math.abs(poItem.unitPrice - invItem.unitPrice) > 0.01) {
        const priceDiff = invItem.unitPrice - poItem.unitPrice;
        const severity = Math.abs(priceDiff) > poItem.unitPrice * 0.05 ? 'HIGH' : 'LOW';
        discrepancies.push({
          discrepancyType: DiscrepancyType.PRICE_MISMATCH,
          itemName: poItem.ingredient.name,
          poValue: `₹${poItem.unitPrice}/${poItem.unit}`,
          invoiceValue: `₹${invItem.unitPrice}/${invItem.unit}`,
          variance: priceDiff,
          severity,
          notes: `Unit price shifted by ₹${priceDiff > 0 ? '+' : ''}${priceDiff.toFixed(2)}`,
        });
        totalVariance += Math.abs(priceDiff * invItem.quantity);
      }
    }

    // Missing Items (Present in PO but missing in Invoice)
    for (const poItem of po.items) {
      if (!matchedPOIngredientIds.has(poItem.ingredientId)) {
        discrepancies.push({
          discrepancyType: DiscrepancyType.MISSING_ITEM,
          itemName: poItem.ingredient.name,
          poValue: `${poItem.quantity} ${poItem.unit} @ ₹${poItem.unitPrice}`,
          invoiceValue: 'Missing in Invoice',
          variance: poItem.totalPrice,
          severity: 'MEDIUM',
          notes: 'Item requested in PO was not billed in the invoice.',
        });
        totalVariance += poItem.totalPrice;
      }
    }

    // Determine overall reconciliation status
    let status: ReconciliationStatus = ReconciliationStatus.MATCHED;
    if (discrepancies.length > 0) {
      const hasHighSeverity = discrepancies.some((d) => d.severity === 'HIGH');
      status = hasHighSeverity ? ReconciliationStatus.REQUIRES_REVIEW : ReconciliationStatus.MINOR_DIFFERENCE;
    }

    // Upsert Reconciliation Record in Database
    const existing = await prisma.reconciliationRecord.findFirst({
      where: { purchaseOrderId, invoiceId },
    });

    if (existing) {
      await prisma.reconciliationDiscrepancy.deleteMany({
        where: { reconciliationRecordId: existing.id },
      });
      await prisma.reconciliationRecord.delete({
        where: { id: existing.id },
      });
    }

    const record = await prisma.reconciliationRecord.create({
      data: {
        purchaseOrderId,
        invoiceId,
        receivingRecordId,
        branchId: po.branchId,
        status,
        totalVariance: Math.round(totalVariance * 100) / 100,
        reviewNotes: discrepancies.length === 0 ? 'All line items, quantities, and prices matched perfectly.' : `${discrepancies.length} discrepancy items flagged for review.`,
      },
    });

    for (const d of discrepancies) {
      await prisma.reconciliationDiscrepancy.create({
        data: {
          reconciliationRecordId: record.id,
          discrepancyType: d.discrepancyType,
          itemName: d.itemName,
          poValue: d.poValue,
          invoiceValue: d.invoiceValue,
          variance: d.variance,
          severity: d.severity,
          notes: d.notes,
        },
      });
    }

    return prisma.reconciliationRecord.findUnique({
      where: { id: record.id },
      include: {
        purchaseOrder: { include: { supplier: true, items: { include: { ingredient: true } } } },
        invoice: { include: { supplier: true, items: true } },
        discrepancies: true,
      },
    });
  }

  /**
   * Managerial Approval for Reconciliation
   */
  static async approveReconciliation(
    reconciliationId: string,
    approvedByUserId: string,
    reviewNotes?: string
  ) {
    const record = await prisma.reconciliationRecord.findUnique({
      where: { id: reconciliationId },
      include: {
        purchaseOrder: true,
        receivingRecord: true,
      },
    });

    if (!record) throw new Error('Reconciliation record not found');

    const updated = await prisma.reconciliationRecord.update({
      where: { id: reconciliationId },
      data: {
        status: ReconciliationStatus.APPROVED,
        approvedByUserId,
        approvedAt: new Date(),
        reviewNotes: reviewNotes || record.reviewNotes || 'Approved by Manager',
      },
    });

    // If receiving record exists and inventory not yet updated, perform post-approval receiving update
    if (record.receivingRecordId) {
      await InventoryEngineService.receiveGoodsAndUpdateStock(
        record.receivingRecordId,
        approvedByUserId
      );
    }

    return updated;
  }
}
