import { Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { OrderStatus, TransactionType } from '@prisma/client';

export class ReportsController {
  /**
   * End-of-Day Consolidation Report
   */
  static async getDailyReport(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const branchId = (req.query.branchId as string) || req.user?.branchId;
      const targetDateStr = (req.query.date as string) || new Date().toISOString().slice(0, 10);

      if (!branchId) {
        res.status(400).json({ success: false, error: 'Branch ID is required' });
        return;
      }

      const dayStart = new Date(`${targetDateStr}T00:00:00.000Z`);
      const dayEnd = new Date(`${targetDateStr}T23:59:59.999Z`);

      const branch = await prisma.branch.findUnique({
        where: { id: branchId },
        include: { restaurant: true },
      });

      // 1. Sales Summary
      const orders = await prisma.order.findMany({
        where: {
          branchId,
          createdAt: { gte: dayStart, lte: dayEnd },
          orderStatus: { not: OrderStatus.CANCELLED },
        },
        include: {
          items: { include: { menuItem: true } },
        },
      });

      const totalSales = orders.reduce((sum, o) => sum + o.totalAmount, 0);
      const totalOrders = orders.length;
      const avgOrderValue = totalOrders > 0 ? Math.round((totalSales / totalOrders) * 100) / 100 : 0;

      // 2. Consumption Summary
      const consumptionTx = await prisma.inventoryTransaction.findMany({
        where: {
          branchId,
          transactionType: TransactionType.SALE_CONSUMPTION,
          createdAt: { gte: dayStart, lte: dayEnd },
        },
        include: { ingredient: true },
      });

      const totalConsumptionCost = consumptionTx.reduce((sum, t) => sum + t.totalCost, 0);
      const foodCostPercent = totalSales > 0 ? Math.round((totalConsumptionCost / totalSales) * 1000) / 10 : 0;

      // Group consumption by ingredient
      const ingUsageMap = new Map<string, { name: string; quantity: number; unit: string; cost: number }>();
      for (const tx of consumptionTx) {
        const existing = ingUsageMap.get(tx.ingredientId) || {
          name: tx.ingredient.name,
          quantity: 0,
          unit: tx.ingredient.stockUnit,
          cost: 0,
        };
        existing.quantity += Math.abs(tx.quantity);
        existing.cost += tx.totalCost;
        ingUsageMap.set(tx.ingredientId, existing);
      }
      const topConsumedIngredients = Array.from(ingUsageMap.values()).sort((a, b) => b.cost - a.cost);

      // 3. Waste Summary
      const wasteRecords = await prisma.wasteRecord.findMany({
        where: {
          branchId,
          recordedAt: { gte: dayStart, lte: dayEnd },
        },
        include: { ingredient: true },
      });
      const totalWasteCost = wasteRecords.reduce((sum, w) => sum + w.totalLoss, 0);

      // 4. Inventory Valuation
      const ingredients = await prisma.ingredient.findMany({ where: { branchId } });
      const currentInventoryValue = ingredients.reduce((sum, i) => sum + (i.currentStock * (i.weightedAverageCost || i.unitCost)), 0);

      // 5. Procurement Summary
      const pos = await prisma.purchaseOrder.findMany({
        where: {
          branchId,
          orderDate: { gte: dayStart, lte: dayEnd },
        },
        include: { supplier: true },
      });
      const poSpend = pos.reduce((sum, p) => sum + p.totalAmount, 0);

      const reportData = {
        branch: {
          id: branch?.id,
          name: branch?.name,
          restaurantName: branch?.restaurant.name,
          address: branch?.address,
        },
        reportDate: targetDateStr,
        sales: {
          totalRevenue: Math.round(totalSales * 100) / 100,
          totalOrders,
          avgOrderValue,
        },
        consumption: {
          totalCost: Math.round(totalConsumptionCost * 100) / 100,
          foodCostPercent,
          topIngredients: topConsumedIngredients.slice(0, 8),
        },
        waste: {
          totalLoss: Math.round(totalWasteCost * 100) / 100,
          recordsCount: wasteRecords.length,
        },
        inventory: {
          closingValue: Math.round(currentInventoryValue * 100) / 100,
          totalSKUs: ingredients.length,
        },
        procurement: {
          poCount: pos.length,
          totalSpend: Math.round(poSpend * 100) / 100,
        },
        generatedAt: new Date(),
      };

      res.json({ success: true, data: reportData });
    } catch (err) {
      next(err);
    }
  }
}
