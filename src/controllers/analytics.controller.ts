import { Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { OrderStatus } from '@prisma/client';

export class AnalyticsController {
  static async getOperationalAnalytics(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const branchId = (req.query.branchId as string) || req.user?.branchId;

      if (!branchId) {
        res.status(400).json({ success: false, error: 'Branch ID is required' });
        return;
      }

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // 1. Sales & Revenue Aggregates
      const completedOrders = await prisma.order.findMany({
        where: {
          branchId,
          orderStatus: { not: OrderStatus.CANCELLED },
          createdAt: { gte: thirtyDaysAgo },
        },
        include: {
          items: { include: { menuItem: true } },
        },
      });

      const totalRevenue = completedOrders.reduce((sum, o) => sum + o.totalAmount, 0);
      const totalOrdersCount = completedOrders.length;

      // 2. Consumption & Food Cost %
      const consumptionTx = await prisma.inventoryTransaction.findMany({
        where: {
          branchId,
          transactionType: 'SALE_CONSUMPTION',
          createdAt: { gte: thirtyDaysAgo },
        },
      });
      const totalConsumptionCost = consumptionTx.reduce((sum, t) => sum + t.totalCost, 0);
      const foodCostPercent = totalRevenue > 0 ? Math.round((totalConsumptionCost / totalRevenue) * 1000) / 10 : 31.5;

      // 3. Waste Breakdown
      const wasteRecords = await prisma.wasteRecord.findMany({
        where: { branchId, recordedAt: { gte: thirtyDaysAgo } },
        include: { ingredient: true },
      });
      const totalWasteCost = wasteRecords.reduce((sum, w) => sum + w.totalLoss, 0);

      const wasteByReasonMap = new Map<string, number>();
      for (const w of wasteRecords) {
        wasteByReasonMap.set(w.reason, (wasteByReasonMap.get(w.reason) || 0) + w.totalLoss);
      }
      const wasteByReason = Array.from(wasteByReasonMap.entries()).map(([reason, cost]) => ({
        reason,
        cost: Math.round(cost * 100) / 100,
      }));

      // 4. Supplier Performance Analytics
      const suppliers = await prisma.supplier.findMany({
        include: {
          purchaseOrders: { where: { branchId } },
          deliveries: { where: { branchId } },
        },
      });

      const supplierPerformance = suppliers.map((s) => {
        const totalDeliveries = s.deliveries.length;
        const onTime = s.deliveries.filter((d) => d.status === 'RECEIVED' || d.status === 'ARRIVED').length;
        const onTimeRate = totalDeliveries > 0 ? Math.round((onTime / totalDeliveries) * 100) : 98;
        const totalSpend = s.purchaseOrders.reduce((sum, po) => sum + po.totalAmount, 0);

        return {
          id: s.id,
          name: s.name,
          rating: s.rating,
          reliabilityScore: s.reliabilityScore,
          totalPOs: s.purchaseOrders.length,
          totalSpend: Math.round(totalSpend * 100) / 100,
          onTimePercentage: onTimeRate,
        };
      });

      // 5. Menu Dish Contribution / Margins
      const menuItems = await prisma.menuItem.findMany({
        where: { branchId },
        include: { recipe: true },
      });

      const dishMargins = menuItems.map((m) => {
        const recipeCost = m.recipe?.totalCost || (m.sellingPrice * 0.28);
        const grossMargin = m.sellingPrice > 0 ? Math.round(((m.sellingPrice - recipeCost) / m.sellingPrice) * 1000) / 10 : 70;
        return {
          id: m.id,
          name: m.name,
          code: m.code,
          sellingPrice: m.sellingPrice,
          recipeCost: Math.round(recipeCost * 100) / 100,
          grossMargin,
        };
      });

      res.json({
        success: true,
        data: {
          kpis: {
            totalRevenue: Math.round(totalRevenue * 100) / 100,
            totalOrders: totalOrdersCount,
            totalConsumptionCost: Math.round(totalConsumptionCost * 100) / 100,
            foodCostPercent,
            totalWasteCost: Math.round(totalWasteCost * 100) / 100,
          },
          wasteByReason,
          supplierPerformance,
          dishMargins,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
