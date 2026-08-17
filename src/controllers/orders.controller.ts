import { Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { InventoryEngineService } from '../services/inventoryEngine.service';
import { AuditService } from '../services/audit.service';
import { OrderType, OrderStatus, PaymentStatus, KitchenItemStatus } from '@prisma/client';

export class OrdersController {
  static async getOrders(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const branchId = (req.query.branchId as string) || req.user?.branchId;
      const status = req.query.status as OrderStatus;
      const type = req.query.type as OrderType;

      const where: any = { branchId };
      if (status) where.orderStatus = status;
      if (type) where.orderType = type;

      const orders = await prisma.order.findMany({
        where,
        include: {
          items: {
            include: { menuItem: true },
          },
          kitchenItems: {
            include: { station: true },
          },
          createdByUser: {
            select: { id: true, name: true, role: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({ success: true, data: orders });
    } catch (err) {
      next(err);
    }
  }

  static async getOrderById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const order = await prisma.order.findUnique({
        where: { id },
        include: {
          items: {
            include: {
              menuItem: {
                include: {
                  recipe: {
                    include: {
                      items: { include: { ingredient: true } },
                    },
                  },
                },
              },
            },
          },
          kitchenItems: {
            include: { station: true },
          },
          createdByUser: { select: { id: true, name: true, email: true, role: true } },
        },
      });

      if (!order) {
        res.status(404).json({ success: false, error: 'Order not found' });
        return;
      }

      res.json({ success: true, data: order });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Manual Order Entry
   */
  static async createOrder(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const branchId = req.body.branchId || req.user?.branchId;
      const {
        orderType,
        tableNumber,
        customerName,
        customerPhone,
        priority,
        paymentStatus,
        notes,
        items,
        autoAccept,
      } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({ success: false, error: 'Order must contain at least one menu item' });
        return;
      }

      const orderCount = await prisma.order.count({ where: { branchId } });
      const orderNumber = `ORD-${100 + orderCount + 1}`;

      // Calculate totals
      let subtotal = 0;
      let taxAmount = 0;

      const preparedItems = [];
      for (const item of items) {
        const menuItem = await prisma.menuItem.findUnique({
          where: { id: item.menuItemId },
        });

        if (!menuItem) {
          res.status(400).json({ success: false, error: `Invalid menuItemId: ${item.menuItemId}` });
          return;
        }

        const qty = parseFloat(item.quantity) || 1.0;
        const lineTotal = qty * menuItem.sellingPrice;
        const lineTax = Math.round((lineTotal * (menuItem.taxRate / 100)) * 100) / 100;

        subtotal += lineTotal;
        taxAmount += lineTax;

        preparedItems.push({
          menuItemId: menuItem.id,
          quantity: qty,
          unitPrice: menuItem.sellingPrice,
          totalPrice: lineTotal,
          stationId: menuItem.stationId,
          notes: item.notes,
        });
      }

      const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;
      const initialStatus = autoAccept ? OrderStatus.ACCEPTED : OrderStatus.NEW;

      const order = await prisma.order.create({
        data: {
          branchId,
          orderNumber,
          orderType: orderType || OrderType.DINE_IN,
          tableNumber,
          customerName,
          customerPhone,
          priority: !!priority,
          paymentStatus: paymentStatus || PaymentStatus.PAID,
          orderStatus: initialStatus,
          subtotal,
          taxAmount,
          totalAmount,
          notes,
          createdByUserId: req.user?.id,
          acceptedAt: autoAccept ? new Date() : null,
          items: {
            create: preparedItems,
          },
        },
        include: {
          items: { include: { menuItem: true } },
        },
      });

      // Route to KDS stations
      for (const item of order.items) {
        if (item.stationId) {
          await prisma.kitchenOrderItem.create({
            data: {
              orderId: order.id,
              orderItemId: item.id,
              stationId: item.stationId,
              status: KitchenItemStatus.NEW,
              priority: !!priority,
            },
          });
        }
      }

      // If auto-accepted, deduct inventory immediately based on BOM
      let inventoryDeductions = null;
      if (autoAccept) {
        inventoryDeductions = await InventoryEngineService.deductStockForOrder(
          order.id,
          req.user?.id
        );
      }

      await AuditService.log({
        branchId,
        userId: req.user?.id,
        action: 'ORDER_CREATED',
        entity: 'Order',
        entityId: order.id,
        newValue: `Order #${order.orderNumber} created (Total: ₹${order.totalAmount})`,
        ipAddress: req.ip,
      });

      res.status(201).json({
        success: true,
        data: order,
        inventoryDeductions,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Transition order status (e.g. ACCEPTED -> Real-time BOM inventory deduction)
   */
  static async updateOrderStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const existing = await prisma.order.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ success: false, error: 'Order not found' });
        return;
      }

      let deductions = null;

      // When order changes from NEW to ACCEPTED, trigger BOM inventory deduction
      if (existing.orderStatus === OrderStatus.NEW && status === OrderStatus.ACCEPTED) {
        deductions = await InventoryEngineService.deductStockForOrder(id, req.user?.id);
      }

      const updated = await prisma.order.update({
        where: { id },
        data: {
          orderStatus: status as OrderStatus,
          acceptedAt: status === OrderStatus.ACCEPTED && !existing.acceptedAt ? new Date() : existing.acceptedAt,
          completedAt: (status === OrderStatus.COMPLETED || status === OrderStatus.SERVED) ? new Date() : existing.completedAt,
        },
        include: {
          items: { include: { menuItem: true } },
          kitchenItems: true,
        },
      });

      // Update KDS status if completed/served
      if (status === OrderStatus.COMPLETED || status === OrderStatus.SERVED) {
        await prisma.kitchenOrderItem.updateMany({
          where: { orderId: id },
          data: { status: KitchenItemStatus.SERVED, completedAt: new Date() },
        });
      }

      await AuditService.log({
        branchId: existing.branchId,
        userId: req.user?.id,
        action: 'ORDER_STATUS_CHANGED',
        entity: 'Order',
        entityId: id,
        previousValue: existing.orderStatus,
        newValue: status,
        ipAddress: req.ip,
      });

      res.json({ success: true, data: updated, inventoryDeductions: deductions });
    } catch (err) {
      next(err);
    }
  }
}
