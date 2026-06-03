import supertest from 'supertest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createTestApp } from './helpers/app';
import { banUser, closeDb } from './helpers/db';

describe('Safety gates (e2e)', () => {
  let app: NestFastifyApplication;
  let req: ReturnType<typeof supertest>;
  let tokenA: string;
  let tokenB: string;
  let userBId: string;
  let storeId: string;

  beforeAll(async () => {
    app = await createTestApp();
    req = supertest(app.getHttpServer());

    const ts = Date.now();
    const [resA, resB] = await Promise.all([
      req.post('/api/v1/auth/dev-login').send({ email: `safe-a-${ts}@e2e.test` }),
      req.post('/api/v1/auth/dev-login').send({ email: `safe-b-${ts}@e2e.test` }),
    ]);
    tokenA = resA.body.accessToken as string;
    tokenB = resB.body.accessToken as string;

    const { body: meB } = await req
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${tokenB}`);
    userBId = meB.id as string;

    const { body: stores } = await req
      .get('/api/v1/stores?q=Mox+Boarding')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    storeId = (stores as Array<{ id: string }>)[0].id;

    // Both users at the same store for presence
    await Promise.all([
      req
        .post('/api/v1/presence/heartbeat')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ storeId }),
      req
        .post('/api/v1/presence/heartbeat')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ storeId }),
    ]);
  });

  afterAll(async () => {
    await closeDb();
    await app.close();
  });

  // -------------------------------------------------------------------------
  // Block exclusion
  // -------------------------------------------------------------------------

  it('User A blocks User B', async () => {
    await req
      .post('/api/v1/blocks')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ userId: userBId })
      .expect(201);
  });

  it('Blocked user is excluded from /discovery/nearby (A → B direction)', async () => {
    const res = await req
      .get('/api/v1/discovery/nearby')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const ids = (res.body.players as Array<{ id: string }>).map((p) => p.id);
    expect(ids).not.toContain(userBId);
  });

  it('Exchange resolve of blocked user returns 404', async () => {
    // User B mints their token
    const { body: mint } = await req
      .post('/api/v1/exchange/token')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);

    // User A (who blocked B) tries to resolve → 404
    await req
      .post('/api/v1/exchange/resolve')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ token: mint.token as string })
      .expect(404);
  });

  // -------------------------------------------------------------------------
  // Banned user
  // -------------------------------------------------------------------------

  it('Banned user token is rejected with 403 account_banned', async () => {
    const ts = Date.now();
    const { body: tokens } = await req
      .post('/api/v1/auth/dev-login')
      .send({ email: `banned-${ts}@e2e.test` })
      .expect(200);
    const bannedToken = tokens.accessToken as string;

    const { body: me } = await req
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${bannedToken}`)
      .expect(200);

    await banUser(me.id as string);

    const res = await req
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${bannedToken}`)
      .expect(403);

    expect(res.body.message).toBe('account_banned');
  });

  it('Exchange resolve of banned user returns 404', async () => {
    const ts = Date.now();
    // Create a user, mint token, then ban them
    const { body: bannedTokens } = await req
      .post('/api/v1/auth/dev-login')
      .send({ email: `banned-exch-${ts}@e2e.test` })
      .expect(200);
    const toBanToken = bannedTokens.accessToken as string;

    const { body: toBanMe } = await req
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${toBanToken}`)
      .expect(200);

    // Mint exchange token while active
    const { body: mint } = await req
      .post('/api/v1/exchange/token')
      .set('Authorization', `Bearer ${toBanToken}`)
      .expect(200);

    // Ban the user
    await banUser(toBanMe.id as string);

    // Resolving their token should return 404 (moderationStatus !== ACTIVE)
    await req
      .post('/api/v1/exchange/resolve')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ token: mint.token as string })
      .expect(404);
  });
});
