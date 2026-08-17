import { prisma } from '../utils/prisma';
import { POStatus } from '@prisma/client';

export interface RecommendationItemDTO {
  ingredientId: string;
  ingredientName: string;
  sku: string;
  categoryName: string;
  currentStock: number;       // stockUnit
  minStock: number;           // stockUnit
  reorderLevel: number;       // stockUnit
  targetStock: number;        // stockUnit
  pendingPurchaseStock: number; // stockUnit
  forecastDailyDemand: number;// stockUnit
  recommendedPurchaseQty: number; // in purchaseUnit
  purchaseUnit: string;
  stockUnit: string;
  conversionFactor: number;
  preferredSupplierId?: string;
  preferredSupplierName?: string;
  unitPrice: number;          // price per purchaseUnit
  estimatedCost: number;
  urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'HEALTHY';
  reason: string;
}

export class PurchaseRecommendationService {
  /**
   * Deterministic Purchase Recommendation Engine
   * Formula:
   * recommendedPurchase = max(0, targetStock - currentStock - pendingPurchase)
   */
  static async generateRecommendations(branchId: string): Promise<{
    items: RecommendationItemDTO[];
    totalEstimatedCost: number;
    generatedAt: Date;
  }> {
    const ingredients = await prisma.ingredient.findMany({
      where: { branchId },
      include: {
        category: true,
        preferredSupplier: true,
        supplierMappings: {
          where: { isPrimary: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Fetch active POs to calculate pending stock
    const activePOs = await prisma.purchaseOrder.findMany({
      where: {
        branchId,
        status: {
          in: [
            POStatus.DRAFT,
            POStatus.PENDING_APPROVAL,
            POStatus.SENT,
            POStatus.SUPPLIER_REVIEWING,
            POStatus.CONFIRMED,
            POStatus.DISPATCHED,
            POStatus.PARTIALLY_CONFIRMED,
            POStatus.PARTIALLY_RECEIVED,
          ],
        },
      },
      include: {
        items: true,
      },
    });

    const pendingStockMap = new Map<string, number>();
    for (const po of activePOs) {
      for (const item of po.items) {
        const remainingToReceive = Math.max(0, item.quantity - (item.acceptedQty || 0));
        const existing = pendingStockMap.get(item.ingredientId) || 0;
        pendingStockMap.set(item.ingredientId, existing + remainingToReceive);
      }
    }

    // Fetch historical consumption for the past 7 days to determine daily forecast demand
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const pastTransactions = await prisma.inventoryTransaction.findMany({
      where: {
        branchId,
        transactionType: 'SALE_CONSUMPTION',
        createdAt: { gte: sevenDaysAgo },
      },
    });

    const consumptionMap = new Map<string, number>();
    for (const tx of pastTransactions) {
      const consumed = Math.abs(tx.quantity);
      consumptionMap.set(tx.ingredientId, (consumptionMap.get(tx.ingredientId) || 0) + consumed);
    }

    const items: RecommendationItemDTO[] = [];
    let totalEstimatedCost = 0;

    for (const ing of ingredients) {
      const pendingInPurchaseUnit = pendingStockMap.get(ing.id) || 0;
      const pendingInStockUnit = pendingInPurchaseUnit * ing.conversionFactor;

      const totalConsumedPast7Days = consumptionMap.get(ing.id) || 0;
      const forecastDailyDemand = Math.max(
        ing.minStock * 0.5,
        Math.round((totalConsumedPast7Days / 7) * 100) / 100
      );

      // Deterministic requirement formula
      const netEffectiveStock = ing.currentStock + pendingInStockUnit;
      const deficitInStockUnit = Math.max(0, ing.targetStock - netEffectiveStock);

      // Convert deficit to purchase unit
      const recommendedPurchaseQty = Math.ceil((deficitInStockUnit / ing.conversionFactor) * 10) / 10;

      // Primary supplier & pricing
      const primaryMapping = ing.supplierMappings[0];
      const unitPrice = primaryMapping ? primaryMapping.price : (ing.unitCost * ing.conversionFactor);
      const estimatedCost = Math.round(recommendedPurchaseQty * unitPrice * 100) / 100;

      let urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'HEALTHY' = 'HEALTHY';
      let reason = 'Stock is within healthy operating levels';

      if (ing.currentStock <= 0) {
        urgency = 'CRITICAL';
        reason = 'Stock completely depleted! Immediate procurement required.';
      } else if (ing.currentStock <= ing.minStock) {
        urgency = 'CRITICAL';
        reason = `Stock (${ing.currentStock / ing.conversionFactor} ${ing.purchaseUnit}) is below minimum safety stock (${ing.minStock / ing.conversionFactor} ${ing.purchaseUnit}).`;
      } else if (ing.currentStock <= ing.reorderLevel) {
        urgency = 'HIGH';
        reason = `Stock is below reorder threshold (${ing.reorderLevel / ing.conversionFactor} ${ing.purchaseUnit}).`;
      } else if (recommendedPurchaseQty > 0) {
        urgency = 'MEDIUM';
        reason = 'Replenishment to reach target buffer stock.';
      }

      if (recommendedPurchaseQty > 0 || urgency !== 'HEALTHY') {
        totalEstimatedCost += estimatedCost;
        items.push({
          ingredientId: ing.id,
          ingredientName: ing.name,
          sku: ing.sku,
          categoryName: ing.category.name,
          currentStock: ing.currentStock,
          minStock: ing.minStock,
          reorderLevel: ing.reorderLevel,
          targetStock: ing.targetStock,
          pendingPurchaseStock: pendingInStockUnit,
          forecastDailyDemand,
          recommendedPurchaseQty: Math.max(recommendedPurchaseQty, 0),
          purchaseUnit: ing.purchaseUnit,
          stockUnit: ing.stockUnit,
          conversionFactor: ing.conversionFactor,
          preferredSupplierId: ing.preferredSupplierId || undefined,
          preferredSupplierName: ing.preferredSupplier?.name || 'Unassigned Supplier',
          unitPrice,
          estimatedCost,
          urgency,
          reason,
        });
      }
    }

    return {
      items,
      totalEstimatedCost: Math.round(totalEstimatedCost * 100) / 100,
      generatedAt: new Date(),
    };
  }
}
