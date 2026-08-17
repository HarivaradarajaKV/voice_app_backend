import { prisma } from '../utils/prisma';

export class AuditService {
  static async log(params: {
    branchId?: string;
    userId?: string;
    action: string;
    entity: string;
    entityId?: string;
    previousValue?: string;
    newValue?: string;
    ipAddress?: string;
  }) {
    try {
      let validUserId = params.userId;
      if (validUserId) {
        const userExists = await prisma.user.findUnique({ where: { id: validUserId } });
        if (!userExists) {
          const fallbackUser = await prisma.user.findFirst();
          validUserId = fallbackUser?.id;
        }
      }

      return await prisma.auditLog.create({
        data: {
          branchId: params.branchId,
          userId: validUserId,
          action: params.action,
          entity: params.entity,
          entityId: params.entityId,
          previousValue: params.previousValue,
          newValue: params.newValue,
          ipAddress: params.ipAddress,
        },
      });
    } catch (err) {
      console.error('Failed to write audit log:', err);
      return null;
    }
  }
}
