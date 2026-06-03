import supertest from 'supertest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createTestApp } from './helpers/app';

describe('Exchange (e2e)', () => {
  let app: NestFastifyApplication;
  let req: ReturnType<typeof supertest>;
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    app = await createTestApp();
    req = supertest(app.getHttpServer());

    const ts = Date.now();
    const [resA, resB] = await Promise.all([
      req.post('/api/v1/auth/dev-login').send({ email: `exch-a-${ts}@e2e.test` }),
      req.post('/api/v1/auth/dev-login').send({ email: `exch-b-${ts}@e2e.test` }),
    ]);
    tokenA = resA.body.accessToken as string;
    tokenB = resB.body.accessToken as string;
  });

  afterAll(() => app.close());

  it('POST /exchange/token returns a token + expiresAt', async () => {
    const res = await req
      .post('/api/v1/exchange/token')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('expiresAt');
  });

  it('POST /exchange/resolve returns public profile, no discord/decks', async () => {
    const { body: mint } = await req
      .post('/api/v1/exchange/token')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const res = await req
      .post('/api/v1/exchange/resolve')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ token: mint.token as string })
      .expect(200);

    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('displayName');
    // Private fields must be absent
    expect(res.body).not.toHaveProperty('discordHandle');
    expect(res.body).not.toHaveProperty('decks');
    expect(res.body).not.toHaveProperty('email');
  });

  it('POST /exchange/resolve with unknown token → 410 Gone', async () => {
    await req
      .post('/api/v1/exchange/resolve')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ token: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' })
      .expect(410);
  });
});
