import supertest from 'supertest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createTestApp } from './helpers/app';

describe('Discovery + Connect (e2e)', () => {
  let app: NestFastifyApplication;
  let req: ReturnType<typeof supertest>;
  let tokenA: string;
  let tokenB: string;
  let userBId: string;
  let connectionId: string;

  beforeAll(async () => {
    app = await createTestApp();
    req = supertest(app.getHttpServer());

    const ts = Date.now();
    const [resA, resB] = await Promise.all([
      req.post('/api/v1/auth/dev-login').send({ email: `disc-a-${ts}@e2e.test` }),
      req.post('/api/v1/auth/dev-login').send({ email: `disc-b-${ts}@e2e.test` }),
    ]);
    tokenA = resA.body.accessToken as string;
    tokenB = resB.body.accessToken as string;

    const { body: meB } = await req.get('/api/v1/me').set('Authorization', `Bearer ${tokenB}`);
    userBId = meB.id as string;

    // Resolve a seeded store ID for presence
    const { body: stores } = await req
      .get('/api/v1/stores?q=Mox+Boarding')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const storeId = (stores as Array<{ id: string }>)[0].id;

    // Both users announce presence at the same store
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

  afterAll(() => app.close());

  it('GET /discovery/nearby shows the other user when both are present', async () => {
    const res = await req
      .get('/api/v1/discovery/nearby')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const ids = (res.body.players as Array<{ id: string }>).map((p) => p.id);
    expect(ids).toContain(userBId);
  });

  it('POST /connections sends a request', async () => {
    const res = await req
      .post('/api/v1/connections')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ addresseeId: userBId })
      .expect(201);

    expect(res.body.status).toBe('pending');
    connectionId = res.body.id as string;
  });

  it('POST /connections/:id/accept accepts the request', async () => {
    const res = await req
      .post(`/api/v1/connections/${connectionId}/accept`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);

    expect(res.body.status).toBe('accepted');
  });

  it('GET /connections/:id exposes peer profile after accept', async () => {
    const res = await req
      .get(`/api/v1/connections/${connectionId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(res.body.status).toBe('accepted');
    expect(res.body).toHaveProperty('peer');
    expect(res.body.peer).toHaveProperty('id', userBId);
  });
});
