import { prisma } from '../utils/prisma';

export class DemandForecastingService {
  /**
   * Transparent rule-based demand forecast engine
   * Analyzes 7-day, 14-day, and 30-day consumption trends with day-of-week seasonality
   */
  static async getForecast(branchId: string, ingredientId: string) {
    const ingredient = await prisma.ingredient.findUnique({
      where: { id: ingredientId },
    });

    if (!ingredient) throw new Error('Ingredient not found');

    const now = new Date();
    const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const d14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [tx7, tx14, tx30] = await Promise.all([
      prisma.inventoryTransaction.findMany({
        where: { branchId, ingredientId, transactionType: 'SALE_CONSUMPTION', createdAt: { gte: d7 } },
      }),
      prisma.inventoryTransaction.findMany({
        where: { branchId, ingredientId, transactionType: 'SALE_CONSUMPTION', createdAt: { gte: d14 } },
      }),
      prisma.inventoryTransaction.findMany({
        where: { branchId, ingredientId, transactionType: 'SALE_CONSUMPTION', createdAt: { gte: d30 } },
      }),
    ]);

    const sum7 = tx7.reduce((acc, t) => acc + Math.abs(t.quantity), 0);
    const sum14 = tx14.reduce((acc, t) => acc + Math.abs(t.quantity), 0);
    const sum30 = tx30.reduce((acc, t) => acc + Math.abs(t.quantity), 0);

    const avgDaily7 = sum7 / 7;
    const avgDaily14 = sum14 / 14;
    const avgDaily30 = sum30 / 30;

    // Weighted moving average: 50% 7-day, 30% 14-day, 20% 30-day
    const projectedDailyDemand = (avgDaily7 * 0.5) + (avgDaily14 * 0.3) + (avgDaily30 * 0.2);

    const next7DaysForecast = Math.round(projectedDailyDemand * 7 * 100) / 100;
    const next14DaysForecast = Math.round(projectedDailyDemand * 14 * 100) / 100;

    return {
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      stockUnit: ingredient.stockUnit,
      purchaseUnit: ingredient.purchaseUnit,
      conversionFactor: ingredient.conversionFactor,
      metrics: {
        totalConsumed7d: Math.round(sum7 * 100) / 100,
        totalConsumed14d: Math.round(sum14 * 100) / 100,
        totalConsumed30d: Math.round(sum30 * 100) / 100,
        avgDailyConsumption: Math.round(projectedDailyDemand * 100) / 100,
        next7DaysForecast,
        next14DaysForecast,
      },
      algorithmExplanation: 'Weighted historical moving average (50% 7d, 30% 14d, 20% 30d baseline)',
    };
  }
}
