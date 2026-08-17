import { Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import bcrypt from 'bcryptjs';
import { AuditService } from '../services/audit.service';
import { RoleType } from '@prisma/client';

export class AdminController {
  // Users
  static async getUsers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const users = await prisma.user.findMany({
        include: {
          branch: true,
          supplier: true,
        },
        orderBy: { name: 'asc' },
      });
      res.json({ success: true, data: users });
    } catch (err) {
      next(err);
    }
  }

  static async createUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { email, password, name, phone, role, branchId, supplierId } = req.body;

      if (!email || !password || !name) {
        res.status(400).json({ success: false, error: 'Email, password, and name are required' });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: {
          email: email.toLowerCase().trim(),
          passwordHash,
          name,
          phone,
          role: (role as RoleType) || RoleType.STAFF,
          branchId: branchId || null,
          supplierId: supplierId || null,
        },
        include: { branch: true },
      });

      await AuditService.log({
        branchId: user.branchId || undefined,
        userId: req.user?.id,
        action: 'USER_CREATED',
        entity: 'User',
        entityId: user.id,
        newValue: `${user.name} created with role ${user.role}`,
        ipAddress: req.ip,
      });

      res.status(201).json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  }

  // Branches
  static async getBranches(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const branches = await prisma.branch.findMany({
        include: {
          restaurant: true,
          _count: { select: { ingredients: true, orders: true, users: true } },
        },
        orderBy: { name: 'asc' },
      });
      res.json({ success: true, data: branches });
    } catch (err) {
      next(err);
    }
  }

  static async createBranch(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { restaurantId, name, code, address, contact, managerName, openingTime, closingTime } = req.body;
      const restId = restaurantId || (await prisma.restaurant.findFirst())?.id;

      const branch = await prisma.branch.create({
        data: {
          restaurantId: restId!,
          name,
          code,
          address,
          contact,
          managerName,
          openingTime: openingTime || '06:00',
          closingTime: closingTime || '23:00',
        },
      });

      res.status(201).json({ success: true, data: branch });
    } catch (err) {
      next(err);
    }
  }

  // Audit Logs
  static async getAuditLogs(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const branchId = (req.query.branchId as string) || req.user?.branchId;
      const logs = await prisma.auditLog.findMany({
        where: branchId ? { branchId } : undefined,
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      res.json({ success: true, data: logs });
    } catch (err) {
      next(err);
    }
  }

  // Notifications
  static async getNotifications(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const branchId = (req.query.branchId as string) || req.user?.branchId;
      const notifications = await prisma.notification.findMany({
        where: branchId ? { branchId } : undefined,
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      res.json({ success: true, data: notifications });
    } catch (err) {
      next(err);
    }
  }

  static async markNotificationRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const updated = await prisma.notification.update({
        where: { id },
        data: { isRead: true },
      });
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
}
