import { prisma } from '../utils/prisma';
import { TransactionType, StockStatus, WasteReason } from '@prisma/client';
import { BOMEngineService } from './bomEngine.service';

export class InventoryEngineService {
  /**
   * Deduct inventory for an entire order based on dynamic BOM portion calculations
   */
  static async deductStockForOrder(orderId: string, performedByUserId?: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            menuItem: {
              include: {
                recipe: true,
              },
            },
          },
        },
      },
    });

    if (!order) throw new Error(`Order not found: ${orderId}`);

    const deductions: Array<{
      ingredientId: string;
      ingredientName: string;
      quantityDeducted: number;
      stockUnit: string;
      previousStock: number;
      newStock: number;
      unitCost: number;
      totalCost: number;
    }> = [];

    // Aggregate requirements across all order items
    const ingredientDeductionsMap = new Map<string, {
      ingredientId: string;
      quantity: number;
    }>();

    for (const orderItem of order.items) {
      if (!orderItem.menuItem.recipe) continue;

      const bomResult = await BOMEngineService.calculateBOMRequirements(
        orderItem.menuItemId,
        orderItem.quantity
      );

      for (const req of bomResult.requirements) {
        const existing = ingredientDeductionsMap.get(req.ingredientId);
        if (existing) {
          existing.quantity += req.quantityRequired;
        } else {
          ingredientDeductionsMap.set(req.ingredientId, {
            ingredientId: req.ingredientId,
            quantity: req.quantityRequired,
          });
        }
      }
    }

    // Execute atomic inventory updates inside transaction
    for (const [ingredientId, { quantity }] of ingredientDeductionsMap.entries()) {
      const ingredient = await prisma.ingredient.findUnique({
        where: { id: ingredientId },
      });

      if (!ingredient) continue;

      const previousStock = ingredient.currentStock;
      const newStock = Math.max(0, previousStock - quantity);

      // Determine stock status
      let status: StockStatus = StockStatus.HEALTHY;
      if (newStock <= 0) {
        status = StockStatus.OUT_OF_STOCK;
      } else if (newStock <= ingredient.minStock) {
        status = StockStatus.CRITICAL;
      } else if (newStock <= ingredient.reorderLevel) {
        status = StockStatus.LOW_STOCK;
      }

      // Update ingredient
      await prisma.ingredient.update({
        where: { id: ingredientId },
        data: {
          currentStock: newStock,
          status,
        },
      });

      const totalCost = Math.round(quantity * ingredient.unitCost * 100) / 100;

      // Log immutable inventory transaction
      await prisma.inventoryTransaction.create({
        data: {
          branchId: order.branchId,
          ingredientId,
          transactionType: TransactionType.SALE_CONSUMPTION,
          quantity: -quantity, // negative delta for consumption
          unit: ingredient.stockUnit,
          unitCost: ingredient.unitCost,
          totalCost,
          previousStock,
          newStock,
          reason: `Sale consumption for Order #${order.orderNumber}`,
          referenceType: 'ORDER',
          referenceId: order.id,
          performedByUserId,
        },
      });

      deductions.push({
        ingredientId,
        ingredientName: ingredient.name,
        quantityDeducted: quantity,
        stockUnit: ingredient.stockUnit,
        previousStock,
        newStock,
        unitCost: ingredient.unitCost,
        totalCost,
      });

      // Generate low stock alert notification if threshold triggered
      if (status === StockStatus.LOW_STOCK || status === StockStatus.CRITICAL || status === StockStatus.OUT_OF_STOCK) {
        await prisma.notification.create({
          data: {
            branchId: order.branchId,
            title: `Low Stock: ${ingredient.name}`,
            message: `${ingredient.name} is currently at ${newStock / ingredient.conversionFactor} ${ingredient.purchaseUnit} (Threshold: ${ingredient.reorderLevel / ingredient.conversionFactor} ${ingredient.purchaseUnit}).`,
            type: 'STOCK_ALERT',
            severity: status === StockStatus.OUT_OF_STOCK || status === StockStatus.CRITICAL ? 'CRITICAL' : 'WARNING',
            link: '/procurement/intelligence',
          },
        });
      }
    }

    return deductions;
  }

  /**
   * Manual Stock Adjustment with reason and audit trail
   */
  static async adjustStock(
    branchId: string,
    ingredientId: string,
    newQuantityInStockUnit: number,
    reason: string,
    performedByUserId?: string,
    notes?: string
  ) {
    const ingredient = await prisma.ingredient.findUnique({
      where: { id: ingredientId },
    });

    if (!ingredient) throw new Error('Ingredient not found');

    const previousStock = ingredient.currentStock;
    const delta = newQuantityInStockUnit - previousStock;

    let status: StockStatus = StockStatus.HEALTHY;
    if (newQuantityInStockUnit <= 0) {
      status = StockStatus.OUT_OF_STOCK;
    } else if (newQuantityInStockUnit <= ingredient.minStock) {
      status = StockStatus.CRITICAL;
    } else if (newQuantityInStockUnit <= ingredient.reorderLevel) {
      status = StockStatus.LOW_STOCK;
    }

    await prisma.ingredient.update({
      where: { id: ingredientId },
      data: {
        currentStock: newQuantityInStockUnit,
        status,
      },
    });

    const totalCost = Math.abs(delta) * ingredient.unitCost;

    const tx = await prisma.inventoryTransaction.create({
      data: {
        branchId,
        ingredientId,
        transactionType: TransactionType.MANUAL_ADJUSTMENT,
        quantity: delta,
        unit: ingredient.stockUnit,
        unitCost: ingredient.unitCost,
        totalCost: Math.round(totalCost * 100) / 100,
        previousStock,
        newStock: newQuantityInStockUnit,
        reason: reason || 'Manual stock level adjustment',
        referenceType: 'MANUAL',
        performedByUserId,
        notes,
      },
    });

    return { ingredient, transaction: tx };
  }

  /**
   * Record Spoilage or Kitchen Waste
   */
  static async recordWaste(
    branchId: string,
    ingredientId: string,
    quantityInStockUnit: number,
    reason: WasteReason,
    notes?: string,
    recordedByUserId?: string
  ) {
    const ingredient = await prisma.ingredient.findUnique({
      where: { id: ingredientId },
    });

    if (!ingredient) throw new Error('Ingredient not found');

    const previousStock = ingredient.currentStock;
    const newStock = Math.max(0, previousStock - quantityInStockUnit);
    const totalLoss = Math.round(quantityInStockUnit * ingredient.unitCost * 100) / 100;

    let status: StockStatus = StockStatus.HEALTHY;
    if (newStock <= 0) status = StockStatus.OUT_OF_STOCK;
    else if (newStock <= ingredient.minStock) status = StockStatus.CRITICAL;
    else if (newStock <= ingredient.reorderLevel) status = StockStatus.LOW_STOCK;

    await prisma.ingredient.update({
      where: { id: ingredientId },
      data: { currentStock: newStock, status },
    });

    const wasteRecord = await prisma.wasteRecord.create({
      data: {
        branchId,
        ingredientId,
        quantity: quantityInStockUnit,
        unit: ingredient.stockUnit,
        unitCost: ingredient.unitCost,
        totalLoss,
        reason,
        notes,
        recordedByUserId,
      },
    });

    await prisma.inventoryTransaction.create({
      data: {
        branchId,
        ingredientId,
        transactionType: TransactionType.WASTE,
        quantity: -quantityInStockUnit,
        unit: ingredient.stockUnit,
        unitCost: ingredient.unitCost,
        totalCost: totalLoss,
        previousStock,
        newStock,
        reason: `Waste recorded: ${reason}`,
        referenceType: 'WASTE',
        referenceId: wasteRecord.id,
        performedByUserId: recordedByUserId,
        notes,
      },
    });

    return wasteRecord;
  }

  /**
   * Receive Goods from Delivery & Recalculate Weighted Average Cost (WAC)
   * Formula: new WAC = (existingStock * existingWAC + receivedQty * newCost) / (existingStock + receivedQty)
   */
  static async receiveGoodsAndUpdateStock(
    receivingRecordId: string,
    performedByUserId?: string
  ) {
    const receiving = await prisma.receivingRecord.findUnique({
      where: { id: receivingRecordId },
      include: {
        items: {
          include: { ingredient: true },
        },
        purchaseOrder: {
          include: { supplier: true },
        },
      },
    });

    if (!receiving) throw new Error('Receiving record not found');

    for (const item of receiving.items) {
      const ingredient = item.ingredient;
      // acceptedQty in purchaseUnit (e.g. kg) -> convert to stockUnit (e.g. grams)
      const receivedInStockUnit = item.acceptedQty * ingredient.conversionFactor;
      if (receivedInStockUnit <= 0) continue;

      const previousStock = ingredient.currentStock;
      const previousCostPerStockUnit = ingredient.weightedAverageCost || ingredient.unitCost;
      const newCostPerStockUnit = item.unitCost / ingredient.conversionFactor;

      const newStock = previousStock + receivedInStockUnit;
      
      // Calculate Weighted Average Cost
      const existingValue = previousStock * previousCostPerStockUnit;
      const newValue = receivedInStockUnit * newCostPerStockUnit;
      const newWeightedAverageCost = newStock > 0 ? (existingValue + newValue) / newStock : newCostPerStockUnit;

      let status: StockStatus = StockStatus.HEALTHY;
      if (newStock > ingredient.reorderLevel) {
        status = StockStatus.HEALTHY;
      } else if (newStock > ingredient.minStock) {
        status = StockStatus.LOW_STOCK;
      } else if (newStock > 0) {
        status = StockStatus.CRITICAL;
      }

      await prisma.ingredient.update({
        where: { id: ingredient.id },
        data: {
          currentStock: newStock,
          weightedAverageCost: Math.round(newWeightedAverageCost * 1000) / 1000,
          unitCost: Math.round(newWeightedAverageCost * 1000) / 1000,
          status,
        },
      });

      // Create Batch
      const batchNumber = item.batchNumber || `BATCH-${ingredient.sku}-${Date.now().toString().slice(-6)}`;
      const batch = await prisma.inventoryBatch.create({
        data: {
          ingredientId: ingredient.id,
          branchId: receiving.branchId,
          batchNumber,
          initialQuantity: receivedInStockUnit,
          remainingQuantity: receivedInStockUnit,
          unitCost: newCostPerStockUnit,
          purchaseDate: receiving.receivedAt,
          expiryDate: item.expiryDate,
          supplierId: receiving.purchaseOrder.supplierId,
        },
      });

      // Create Transaction
      await prisma.inventoryTransaction.create({
        data: {
          branchId: receiving.branchId,
          ingredientId: ingredient.id,
          batchId: batch.id,
          transactionType: TransactionType.PURCHASE_RECEIPT,
          quantity: receivedInStockUnit,
          unit: ingredient.stockUnit,
          unitCost: newCostPerStockUnit,
          totalCost: Math.round(receivedInStockUnit * newCostPerStockUnit * 100) / 100,
          previousStock,
          newStock,
          reason: `Goods receipt from PO #${receiving.purchaseOrder.poNumber} (${receiving.receivingNumber})`,
          referenceType: 'PO',
          referenceId: receiving.purchaseOrderId,
          performedByUserId,
        },
      });
    }

    return receiving;
  }
}
