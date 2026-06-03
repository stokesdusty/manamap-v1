import { PrismaClient, ModerationStatus } from '@prisma/client';

let _prisma: PrismaClient | undefined;

export function db(): PrismaClient {
  if (!_prisma) {
    _prisma = new PrismaClient();
  }
  return _prisma;
}

export async function closeDb(): Promise<void> {
  if (_prisma) {
    await _prisma.$disconnect();
    _prisma = undefined;
  }
}

export async function banUser(userId: string): Promise<void> {
  await db().user.update({
    where: { id: userId },
    data: { moderationStatus: ModerationStatus.BANNED },
  });
}
