import { Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { InventoryEngineService } from '../services/inventoryEngine.service';
import { AuditService } from '../services/audit.service';
import { StockStatus, WasteReason } from '@prisma/client';

export class InventoryController {
  static async getIngredients(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const branchId = (req.query.branchId as string) || req.user?.branchId;
      const categoryId = req.query.categoryId as string;
      const status = req.query.status as StockStatus;
      const search = req.query.search as string;

      const where: any = { branchId };
      if (categoryId) where.categoryId = categoryId;
      if (status) where.status = status;
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
        ];
      }

      const ingredients = await prisma.ingredient.findMany({
        where,
        include: {
          category: true,
          preferredSupplier: true,
          secondarySupplier: true,
          supplierMappings: { include: { supplier: true } },
        },
        orderBy: { name: 'asc' },
      });

      res.json({ success: true, data: ingredients });
    } catch (err) {
      next(err);
    }
  }

  static async getIngredientById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const ingredient = await prisma.ingredient.findUnique({
        where: { id },
        include: {
          category: true,
          preferredSupplier: true,
          secondarySupplier: true,
          batches: { where: { remainingQuantity: { gt: 0 } } },
          transactions: { orderBy: { createdAt: 'desc' }, take: 20 },
          recipeBOMItems: { include: { recipe: { include: { menuItem: true } } } },
        },
      });

      if (!ingredient) {
        res.status(404).json({ success: false, error: 'Ingredient not found' });
        return;
      }

      res.json({ success: true, data: ingredient });
    } catch (err) {
      next(err);
    }
  }

  static async createIngredient(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const branchId = req.body.branchId || req.user?.branchId;
      const {
        name,
        sku,
        categoryId,
        baseUnit,
        purchaseUnit,
        stockUnit,
        conversionFactor,
        currentStock,
        minStock,
        reorderLevel,
        targetStock,
        maxStock,
        unitCost,
        preferredSupplierId,
        storageLocation,
      } = req.body;

      const stock = currentStock || 0;
      let status: StockStatus = StockStatus.HEALTHY;
      if (stock <= 0) status = StockStatus.OUT_OF_STOCK;
      else if (stock <= minStock) status = StockStatus.CRITICAL;
      else if (stock <= reorderLevel) status = StockStatus.LOW_STOCK;

      const ingredient = await prisma.ingredient.create({
        data: {
          branchId,
          name,
          sku: sku || `ING-${name.slice(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
          categoryId,
          baseUnit: baseUnit || 'kg',
          purchaseUnit: purchaseUnit || 'kg',
          stockUnit: stockUnit || 'g',
          conversionFactor: parseFloat(conversionFactor) || 1000.0,
          currentStock: parseFloat(stock),
          minStock: parseFloat(minStock) || 1000.0,
          reorderLevel: parseFloat(reorderLevel) || 2000.0,
          targetStock: parseFloat(targetStock) || 5000.0,
          maxStock: parseFloat(maxStock) || 10000.0,
          unitCost: parseFloat(unitCost) || 0.0,
          weightedAverageCost: parseFloat(unitCost) || 0.0,
          status,
          preferredSupplierId: preferredSupplierId || null,
          storageLocation,
        },
      });

      await AuditService.log({
        branchId,
        userId: req.user?.id,
        action: 'INGREDIENT_CREATED',
        entity: 'Ingredient',
        entityId: ingredient.id,
        newValue: `${ingredient.name} (${ingredient.sku}) created`,
        ipAddress: req.ip,
      });

      res.status(201).json({ success: true, data: ingredient });
    } catch (err) {
      next(err);
    }
  }

  static async updateIngredient(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const ingredient = await prisma.ingredient.update({
        where: { id },
        data: req.body,
      });

      await AuditService.log({
        branchId: ingredient.branchId,
        userId: req.user?.id,
        action: 'INGREDIENT_UPDATED',
        entity: 'Ingredient',
        entityId: ingredient.id,
        newValue: `Updated details for ${ingredient.name}`,
        ipAddress: req.ip,
      });

      res.json({ success: true, data: ingredient });
    } catch (err) {
      next(err);
    }
  }

  static async adjustStock(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { newQuantity, reason, notes } = req.body;

      if (newQuantity === undefined || !reason) {
        res.status(400).json({ success: false, error: 'New quantity and reason are required' });
        return;
      }

      const ing = await prisma.ingredient.findUnique({ where: { id } });
      if (!ing) {
        res.status(404).json({ success: false, error: 'Ingredient not found' });
        return;
      }

      const result = await InventoryEngineService.adjustStock(
        ing.branchId,
        id,
        parseFloat(newQuantity),
        reason,
        req.user?.id,
        notes
      );

      await AuditService.log({
        branchId: ing.branchId,
        userId: req.user?.id,
        action: 'STOCK_ADJUSTED',
        entity: 'Ingredient',
        entityId: id,
        previousValue: `${ing.currentStock} ${ing.stockUnit}`,
        newValue: `${newQuantity} ${ing.stockUnit} (Reason: ${reason})`,
        ipAddress: req.ip,
      });

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async recordWaste(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { ingredientId, quantity, reason, notes } = req.body;

      if (!ingredientId || !quantity || !reason) {
        res.status(400).json({ success: false, error: 'Ingredient, quantity, and reason are required' });
        return;
      }

      const ing = await prisma.ingredient.findUnique({ where: { id: ingredientId } });
      if (!ing) {
        res.status(404).json({ success: false, error: 'Ingredient not found' });
        return;
      }

      const wasteRecord = await InventoryEngineService.recordWaste(
        ing.branchId,
        ingredientId,
        parseFloat(quantity),
        reason as WasteReason,
        notes,
        req.user?.id
      );

      await AuditService.log({
        branchId: ing.branchId,
        userId: req.user?.id,
        action: 'WASTE_RECORDED',
        entity: 'WasteRecord',
        entityId: wasteRecord.id,
        newValue: `${quantity} ${ing.stockUnit} of ${ing.name} logged as ${reason}`,
        ipAddress: req.ip,
      });

      res.status(201).json({ success: true, data: wasteRecord });
    } catch (err) {
      next(err);
    }
  }

  static async getTransactions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const branchId = (req.query.branchId as string) || req.user?.branchId;
      const ingredientId = req.query.ingredientId as string;
      const type = req.query.type as string;

      const where: any = { branchId };
      if (ingredientId) where.ingredientId = ingredientId;
      if (type) where.transactionType = type;

      const transactions = await prisma.inventoryTransaction.findMany({
        where,
        include: {
          ingredient: true,
          performedByUser: { select: { id: true, name: true, email: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      res.json({ success: true, data: transactions });
    } catch (err) {
      next(err);
    }
  }

  static async getWasteRecords(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const branchId = (req.query.branchId as string) || req.user?.branchId;
      const wasteRecords = await prisma.wasteRecord.findMany({
        where: { branchId },
        include: {
          ingredient: true,
          recordedByUser: { select: { id: true, name: true, email: true, role: true } },
        },
        orderBy: { recordedAt: 'desc' },
      });

      res.json({ success: true, data: wasteRecords });
    } catch (err) {
      next(err);
    }
  }

  static async getCategories(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const categories = await prisma.ingredientCategory.findMany({
        include: { _count: { select: { ingredients: true } } },
      });
      res.json({ success: true, data: categories });
    } catch (err) {
      next(err);
    }
  }

  static async getUnits(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const units = await prisma.unit.findMany();
      const conversions = await prisma.unitConversion.findMany();
      res.json({ success: true, data: { units, conversions } });
    } catch (err) {
      next(err);
    }
  }
}
