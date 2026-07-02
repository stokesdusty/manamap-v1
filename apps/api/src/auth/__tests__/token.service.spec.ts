import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { TokenService } from '../token.service';
import { PrismaService } from '../../prisma/prisma.service';

const MOCK_USER = { id: 'user-uuid', email: 'test@example.com' };

function makePrismaMock() {
  return {
    user: {
      findUnique: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };
}

describe('TokenService', () => {
  let service: TokenService;
  let jwtService: jest.Mocked<Pick<JwtService, 'sign' | 'verify'>>;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    jwtService = { sign: jest.fn().mockReturnValue('signed.access.token'), verify: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: JwtService, useValue: jwtService },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(TokenService);
  });

  // ---------------------------------------------------------------------------
  // issueTokens
  // ---------------------------------------------------------------------------

  describe('issueTokens', () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({ role: 'USER' });
      prisma.refreshToken.create.mockResolvedValue({});
    });

    it('returns a signed access token', async () => {
      const result = await service.issueTokens(MOCK_USER.id);
      expect(result.accessToken).toBe('signed.access.token');
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: MOCK_USER.id,
        role: 'USER',
      });
    });

    it('returns a 64-char hex refresh token (32 random bytes)', async () => {
      const { refreshToken } = await service.issueTokens(MOCK_USER.id);
      expect(refreshToken).toMatch(/^[0-9a-f]{64}$/);
    });

    it('stores a SHA-256 hash — NOT the raw token', async () => {
      const { refreshToken } = await service.issueTokens(MOCK_USER.id);
      const stored = prisma.refreshToken.create.mock.calls[0][0].data.tokenHash as string;
      expect(stored).not.toBe(refreshToken);
      expect(stored).toMatch(/^[0-9a-f]{64}$/); // 32-byte SHA-256 hex
    });

    it('sets expiresAt ~30 days in the future', async () => {
      await service.issueTokens(MOCK_USER.id);
      const { expiresAt } = prisma.refreshToken.create.mock.calls[0][0].data as { expiresAt: Date };
      const diff = expiresAt.getTime() - Date.now();
      expect(diff).toBeGreaterThan(29 * 24 * 3600 * 1000);
      expect(diff).toBeLessThan(31 * 24 * 3600 * 1000);
    });

    it('returns expiresIn = 900 (15 min)', async () => {
      const { expiresIn } = await service.issueTokens(MOCK_USER.id);
      expect(expiresIn).toBe(900);
    });
  });

  // ---------------------------------------------------------------------------
  // rotate
  // ---------------------------------------------------------------------------

  describe('rotate', () => {
    it('issues fresh tokens when the raw token matches a live record', async () => {
      prisma.user.findUnique.mockResolvedValue({ role: 'USER' });
      prisma.refreshToken.findFirst.mockResolvedValue({
        id: 'rt-id',
        userId: MOCK_USER.id,
        user: MOCK_USER,
      });
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.rotate('valid-raw-token');

      expect(result.accessToken).toBe('signed.access.token');
      expect(result.refreshToken).toMatch(/^[0-9a-f]{64}$/);
    });

    it('revokes the old token before issuing new ones', async () => {
      prisma.user.findUnique.mockResolvedValue({ role: 'USER' });
      prisma.refreshToken.findFirst.mockResolvedValue({
        id: 'rt-id',
        userId: MOCK_USER.id,
        user: MOCK_USER,
      });
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      await service.rotate('valid-raw-token');

      expect(prisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rt-id' },
          data: expect.objectContaining({ revokedAt: expect.any(Date) }),
        }),
      );
    });

    it('throws UnauthorizedException when token not found / already revoked', async () => {
      prisma.refreshToken.findFirst.mockResolvedValue(null);
      await expect(service.rotate('bad-token')).rejects.toThrow(UnauthorizedException);
    });

    it('queries with revokedAt: null and expiresAt > now (rejects stale tokens)', async () => {
      prisma.refreshToken.findFirst.mockResolvedValue(null);
      await service.rotate('any').catch(() => null);

      const where = prisma.refreshToken.findFirst.mock.calls[0][0].where as Record<string, unknown>;
      expect(where).toMatchObject({ revokedAt: null, expiresAt: { gt: expect.any(Date) } });
    });
  });

  // ---------------------------------------------------------------------------
  // revoke
  // ---------------------------------------------------------------------------

  describe('revoke', () => {
    it('calls updateMany with the hashed token and sets revokedAt', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
      await service.revoke('raw-token');

      const call = prisma.refreshToken.updateMany.mock.calls[0][0] as {
        where: { tokenHash: string; revokedAt: null };
        data: { revokedAt: Date };
      };
      expect(call.where.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(call.where.revokedAt).toBeNull();
      expect(call.data.revokedAt).toBeInstanceOf(Date);
    });
  });
});
