import { Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { KitchenItemStatus, OrderStatus } from '@prisma/client';

export class KDSController {
  static async getKitchenOrders(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const branchId = (req.query.branchId as string) || req.user?.branchId;
      const stationId = req.query.stationId as string;

      const where: any = {
        branchId,
        orderStatus: { in: [OrderStatus.NEW, OrderStatus.ACCEPTED, OrderStatus.PREPARING, OrderStatus.READY] },
      };

      const orders = await prisma.order.findMany({
        where,
        include: {
          items: {
            where: stationId ? { stationId } : undefined,
            include: {
              menuItem: {
                include: { station: true },
              },
            },
          },
          kitchenItems: {
            where: stationId ? { stationId } : undefined,
            include: { station: true },
          },
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'asc' },
        ],
      });

      // Filter out orders that have 0 items for the selected station
      const filteredOrders = stationId
        ? orders.filter((o) => o.items.length > 0)
        : orders;

      res.json({ success: true, data: filteredOrders });
    } catch (err) {
      next(err);
    }
  }

  static async updateKitchenItemStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params; // kitchenOrderItem id or orderId
      const { status } = req.body;

      const kitchenItem = await prisma.kitchenOrderItem.findUnique({
        where: { id },
        include: { order: true },
      });

      if (!kitchenItem) {
        res.status(404).json({ success: false, error: 'Kitchen item not found' });
        return;
      }

      const updated = await prisma.kitchenOrderItem.update({
        where: { id },
        data: {
          status: status as KitchenItemStatus,
          startedAt: status === KitchenItemStatus.PREPARING && !kitchenItem.startedAt ? new Date() : kitchenItem.startedAt,
          readyAt: status === KitchenItemStatus.READY && !kitchenItem.readyAt ? new Date() : kitchenItem.readyAt,
          completedAt: status === KitchenItemStatus.SERVED && !kitchenItem.completedAt ? new Date() : kitchenItem.completedAt,
        },
      });

      // Also update order item status
      await prisma.orderItem.update({
        where: { id: kitchenItem.orderItemId },
        data: { itemStatus: status as KitchenItemStatus },
      });

      // Check all items in order to update parent Order status
      const allItems = await prisma.kitchenOrderItem.findMany({
        where: { orderId: kitchenItem.orderId },
      });

      const allReady = allItems.every((i) => i.status === KitchenItemStatus.READY || i.status === KitchenItemStatus.SERVED);
      const anyPreparing = allItems.some((i) => i.status === KitchenItemStatus.PREPARING);

      if (allReady) {
        await prisma.order.update({
          where: { id: kitchenItem.orderId },
          data: { orderStatus: OrderStatus.READY },
        });
      } else if (anyPreparing) {
        await prisma.order.update({
          where: { id: kitchenItem.orderId },
          data: { orderStatus: OrderStatus.PREPARING },
        });
      }

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }

  static async getStations(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const branchId = (req.query.branchId as string) || req.user?.branchId;
      const stations = await prisma.kitchenStation.findMany({
        where: { branchId, isActive: true },
        include: { _count: { select: { menuItems: true } } },
      });
      res.json({ success: true, data: stations });
    } catch (err) {
      next(err);
    }
  }
}
