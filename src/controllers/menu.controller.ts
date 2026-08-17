import { Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { BOMEngineService } from '../services/bomEngine.service';
import { AuditService } from '../services/audit.service';

export class MenuController {
  static async getMenuItems(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const branchId = (req.query.branchId as string) || req.user?.branchId;
      const categoryId = req.query.categoryId as string;

      const where: any = { branchId };
      if (categoryId) where.categoryId = categoryId;

      const items = await prisma.menuItem.findMany({
        where,
        include: {
          category: true,
          station: true,
          recipe: {
            include: {
              items: { include: { ingredient: true } },
            },
          },
        },
        orderBy: { name: 'asc' },
      });

      res.json({ success: true, data: items });
    } catch (err) {
      next(err);
    }
  }

  static async getMenuItemById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const item = await prisma.menuItem.findUnique({
        where: { id },
        include: {
          category: true,
          station: true,
          recipe: {
            include: {
              items: { include: { ingredient: true } },
              versions: { orderBy: { createdAt: 'desc' } },
            },
          },
        },
      });

      if (!item) {
        res.status(404).json({ success: false, error: 'Menu item not found' });
        return;
      }

      res.json({ success: true, data: item });
    } catch (err) {
      next(err);
    }
  }

  static async createMenuItem(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const branchId = req.body.branchId || req.user?.branchId;
      const { name, code, categoryId, description, sellingPrice, taxRate, stationId, standardPortion } = req.body;

      const menuItem = await prisma.menuItem.create({
        data: {
          branchId,
          name,
          code: code || `MENU-${name.slice(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
          categoryId,
          description,
          sellingPrice: parseFloat(sellingPrice),
          taxRate: parseFloat(taxRate) || 5.0,
          stationId: stationId || null,
          standardPortion: parseFloat(standardPortion) || 1.0,
        },
      });

      await AuditService.log({
        branchId,
        userId: req.user?.id,
        action: 'MENU_ITEM_CREATED',
        entity: 'MenuItem',
        entityId: menuItem.id,
        newValue: `${menuItem.name} (${menuItem.code}) created at ₹${menuItem.sellingPrice}`,
        ipAddress: req.ip,
      });

      res.status(201).json({ success: true, data: menuItem });
    } catch (err) {
      next(err);
    }
  }

  static async updateMenuItem(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const item = await prisma.menuItem.update({
        where: { id },
        data: req.body,
      });

      res.json({ success: true, data: item });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Create or Update Recipe BOM
   */
  static async saveRecipeBOM(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { menuItemId, name, standardPortion, items } = req.body;

      if (!menuItemId || !items || !Array.isArray(items)) {
        res.status(400).json({ success: false, error: 'menuItemId and items array are required' });
        return;
      }

      const existingRecipe = await prisma.recipe.findUnique({
        where: { menuItemId },
        include: { items: true },
      });

      let recipe;
      if (existingRecipe) {
        // Create version snapshot before updating
        await prisma.recipeVersion.create({
          data: {
            recipeId: existingRecipe.id,
            versionNumber: existingRecipe.version,
            snapshotJson: JSON.stringify(existingRecipe),
            changedByUserId: req.user?.id,
            reason: 'BOM updated by user',
          },
        });

        // Delete old items and insert updated items
        await prisma.recipeBOMItem.deleteMany({ where: { recipeId: existingRecipe.id } });

        recipe = await prisma.recipe.update({
          where: { id: existingRecipe.id },
          data: {
            name: name || existingRecipe.name,
            standardPortion: parseFloat(standardPortion) || existingRecipe.standardPortion,
            version: existingRecipe.version + 1,
            items: {
              create: items.map((i: any) => ({
                ingredientId: i.ingredientId,
                quantity: parseFloat(i.quantity),
                unit: i.unit || 'g',
                prepLossPercent: parseFloat(i.prepLossPercent) || 0.0,
                yieldPercent: parseFloat(i.yieldPercent) || 100.0,
                isOptional: !!i.isOptional,
                notes: i.notes,
              })),
            },
          },
          include: {
            items: { include: { ingredient: true } },
          },
        });
      } else {
        recipe = await prisma.recipe.create({
          data: {
            menuItemId,
            name: name || 'Standard Recipe BOM',
            standardPortion: parseFloat(standardPortion) || 1.0,
            version: 1,
            items: {
              create: items.map((i: any) => ({
                ingredientId: i.ingredientId,
                quantity: parseFloat(i.quantity),
                unit: i.unit || 'g',
                prepLossPercent: parseFloat(i.prepLossPercent) || 0.0,
                yieldPercent: parseFloat(i.yieldPercent) || 100.0,
                isOptional: !!i.isOptional,
                notes: i.notes,
              })),
            },
          },
          include: {
            items: { include: { ingredient: true } },
          },
        });
      }

      // Recalculate standard costing
      const costing = await BOMEngineService.recalculateRecipeCost(recipe.id);

      await AuditService.log({
        branchId: req.user?.branchId,
        userId: req.user?.id,
        action: 'BOM_SAVED',
        entity: 'Recipe',
        entityId: recipe.id,
        newValue: `Recipe ${recipe.name} v${recipe.version} saved (Cost: ₹${costing.totalCost}, Margin: ${costing.grossMargin}%)`,
        ipAddress: req.ip,
      });

      res.json({ success: true, data: { ...recipe, ...costing } });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Deterministic BOM portion simulation endpoint
   */
  static async simulatePortionScaling(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { menuItemId, quantity } = req.body;

      if (!menuItemId || quantity === undefined) {
        res.status(400).json({ success: false, error: 'menuItemId and quantity are required' });
        return;
      }

      const result = await BOMEngineService.calculateBOMRequirements(
        menuItemId,
        parseFloat(quantity)
      );

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async getMenuCategories(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const categories = await prisma.menuCategory.findMany({
        include: { _count: { select: { menuItems: true } } },
        orderBy: { sortOrder: 'asc' },
      });
      res.json({ success: true, data: categories });
    } catch (err) {
      next(err);
    }
  }
}
