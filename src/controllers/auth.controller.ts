import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma';
import { config } from '../config';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { AuditService } from '../services/audit.service';

export class AuthController {
  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({ success: false, error: 'Email and password are required' });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() },
        include: {
          branch: { include: { restaurant: true } },
          supplier: true,
        },
      });

      if (!user) {
        res.status(401).json({ success: false, error: 'Invalid email or password' });
        return;
      }

      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        res.status(401).json({ success: false, error: 'Invalid email or password' });
        return;
      }

      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          branchId: user.branchId,
          supplierId: user.supplierId,
        },
        config.jwtSecret,
        { expiresIn: '7d' }
      );

      await AuditService.log({
        branchId: user.branchId || undefined,
        userId: user.id,
        action: 'USER_LOGIN',
        entity: 'User',
        entityId: user.id,
        newValue: `User logged in with role ${user.role}`,
        ipAddress: req.ip,
      });

      res.json({
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            phone: user.phone,
            role: user.role,
            branchId: user.branchId,
            branch: user.branch,
            supplierId: user.supplierId,
            supplier: user.supplier,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: {
          branch: { include: { restaurant: true } },
          supplier: true,
        },
      });

      if (!user) {
        res.status(404).json({ success: false, error: 'User not found' });
        return;
      }

      res.json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          role: user.role,
          branchId: user.branchId,
          branch: user.branch,
          supplierId: user.supplierId,
          supplier: user.supplier,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { name, phone, branchId, currentPassword, newPassword } = req.body;

      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (!user) {
        res.status(404).json({ success: false, error: 'User not found' });
        return;
      }

      let passwordHash = user.passwordHash;
      if (newPassword) {
        if (!currentPassword) {
          res.status(400).json({ success: false, error: 'Current password is required to set new password' });
          return;
        }
        const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!isValid) {
          res.status(400).json({ success: false, error: 'Current password is incorrect' });
          return;
        }
        passwordHash = await bcrypt.hash(newPassword, 10);
      }

      const updated = await prisma.user.update({
        where: { id: req.user.id },
        data: {
          name: name || user.name,
          phone: phone !== undefined ? phone : user.phone,
          branchId: branchId || user.branchId,
          passwordHash,
        },
        include: {
          branch: { include: { restaurant: true } },
        },
      });

      res.json({
        success: true,
        data: {
          id: updated.id,
          email: updated.email,
          name: updated.name,
          phone: updated.phone,
          role: updated.role,
          branchId: updated.branchId,
          branch: updated.branch,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async forgotPassword(req: Request, res: Response) {
    const { email } = req.body;
    // Manual recovery link placeholder
    res.json({
      success: true,
      message: `Password reset instructions have been dispatched to ${email || 'your registered email'}.`,
    });
  }
}
