import supertest from 'supertest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createTestApp } from './helpers/app';

describe('Games – log + confirm + stats (e2e)', () => {
  let app: NestFastifyApplication;
  let req: ReturnType<typeof supertest>;
  let tokenA: string;
  let tokenB: string;
  let userAId: string;
  let userBId: string;
  let gameId: string;

  beforeAll(async () => {
    app = await createTestApp();
    req = supertest(app.getHttpServer());

    const ts = Date.now();
    const [resA, resB] = await Promise.all([
      req.post('/api/v1/auth/dev-login').send({ email: `game-a-${ts}@e2e.test` }),
      req.post('/api/v1/auth/dev-login').send({ email: `game-b-${ts}@e2e.test` }),
    ]);
    tokenA = resA.body.accessToken as string;
    tokenB = resB.body.accessToken as string;

    const [meA, meB] = await Promise.all([
      req.get('/api/v1/me').set('Authorization', `Bearer ${tokenA}`),
      req.get('/api/v1/me').set('Authorization', `Bearer ${tokenB}`),
    ]);
    userAId = meA.body.id as string;
    userBId = meB.body.id as string;
  });

  afterAll(() => app.close());

  it('POST /games creates a PENDING game (creator auto-confirmed)', async () => {
    const res = await req
      .post('/api/v1/games')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        winnerId: userAId,
        players: [{ userId: userAId }, { userId: userBId }],
        format: 'commander',
      })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body.status).toBe('PENDING');
    gameId = res.body.id as string;
  });

  it('GET /games/pending includes the new game for User B', async () => {
    const res = await req
      .get('/api/v1/games/pending')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);

    const ids = (res.body as Array<{ id: string }>).map((g) => g.id);
    expect(ids).toContain(gameId);
  });

  it('POST /games/:id/confirm as User B → CONFIRMED', async () => {
    const res = await req
      .post(`/api/v1/games/${gameId}/confirm`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);

    expect(res.body.status).toBe('CONFIRMED');
  });

  it('GET /me/stats for winner shows win', async () => {
    const res = await req
      .get('/api/v1/me/stats')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(res.body.wins).toBeGreaterThanOrEqual(1);
    expect(res.body.losses).toBe(0);
    expect(typeof res.body.winRate).toBe('number');
  });

  it('GET /me/stats for loser shows loss', async () => {
    const res = await req
      .get('/api/v1/me/stats')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);

    expect(res.body.wins).toBe(0);
    expect(res.body.losses).toBeGreaterThanOrEqual(1);
  });
});
