import { prisma } from '../utils/prisma';

export interface BOMRequirement {
  ingredientId: string;
  ingredientName: string;
  sku: string;
  stockUnit: string;
  quantityRequired: number; // in stockUnit (e.g. grams, ml)
  currentStock: number;
  isAvailable: boolean;
  unitCost: number;
  totalCost: number;
}

export interface BOMCalculationResult {
  menuItemId: string;
  menuItemName: string;
  orderedQuantity: number;
  standardPortion: number;
  scalingFactor: number;
  requirements: BOMRequirement[];
  totalCost: number;
  allAvailable: boolean;
}

export class BOMEngineService {
  /**
   * Deterministic dynamic portion scaling formula:
   * scalingFactor = orderedQuantity / standardPortion
   * ingredientRequired = BOMIngredientQuantity * scalingFactor
   */
  static async calculateBOMRequirements(
    menuItemId: string,
    orderedQuantity: number
  ): Promise<BOMCalculationResult> {
    const menuItem = await prisma.menuItem.findUnique({
      where: { id: menuItemId },
      include: {
        recipe: {
          include: {
            items: {
              include: {
                ingredient: true,
              },
            },
          },
        },
      },
    });

    if (!menuItem) {
      throw new Error(`Menu item not found: ${menuItemId}`);
    }

    if (!menuItem.recipe || menuItem.recipe.items.length === 0) {
      throw new Error(`No active Recipe/BOM found for menu item: ${menuItem.name}`);
    }

    const standardPortion = menuItem.recipe.standardPortion || menuItem.standardPortion || 1.0;
    const scalingFactor = orderedQuantity / standardPortion;

    let totalCost = 0;
    let allAvailable = true;

    const requirements: BOMRequirement[] = menuItem.recipe.items.map((item) => {
      // Dynamic BOM quantity scaling
      const baseRequired = item.quantity * scalingFactor;
      // Account for preparation loss and yield
      const lossMultiplier = 1 + (item.prepLossPercent || 0) / 100;
      const yieldDivisor = (item.yieldPercent || 100) / 100;
      const finalRequired = Math.round((baseRequired * lossMultiplier / yieldDivisor) * 100) / 100;

      const isAvailable = item.ingredient.currentStock >= finalRequired;
      if (!isAvailable && !item.isOptional) {
        allAvailable = false;
      }

      const itemCost = Math.round(finalRequired * item.ingredient.unitCost * 100) / 100;
      totalCost += itemCost;

      return {
        ingredientId: item.ingredient.id,
        ingredientName: item.ingredient.name,
        sku: item.ingredient.sku,
        stockUnit: item.ingredient.stockUnit,
        quantityRequired: finalRequired,
        currentStock: item.ingredient.currentStock,
        isAvailable,
        unitCost: item.ingredient.unitCost,
        totalCost: itemCost,
      };
    });

    return {
      menuItemId: menuItem.id,
      menuItemName: menuItem.name,
      orderedQuantity,
      standardPortion,
      scalingFactor,
      requirements,
      totalCost: Math.round(totalCost * 100) / 100,
      allAvailable,
    };
  }

  /**
   * Recalculate Recipe standard cost and gross margin based on latest ingredient unit costs
   */
  static async recalculateRecipeCost(recipeId: string): Promise<{ totalCost: number; grossMargin: number }> {
    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId },
      include: {
        menuItem: true,
        items: {
          include: { ingredient: true },
        },
      },
    });

    if (!recipe) throw new Error('Recipe not found');

    let totalCost = 0;
    for (const item of recipe.items) {
      const itemCost = item.quantity * (item.ingredient.weightedAverageCost || item.ingredient.unitCost);
      totalCost += itemCost;
    }

    const sellingPrice = (recipe.menuItem.sellingPrice * recipe.standardPortion) / (recipe.menuItem.standardPortion || 1.0);
    const grossMargin = sellingPrice > 0 ? Math.round(((sellingPrice - totalCost) / sellingPrice) * 1000) / 10 : 0;

    await prisma.recipe.update({
      where: { id: recipeId },
      data: {
        totalCost: Math.round(totalCost * 100) / 100,
        grossMargin,
      },
    });

    return { totalCost: Math.round(totalCost * 100) / 100, grossMargin };
  }
}
