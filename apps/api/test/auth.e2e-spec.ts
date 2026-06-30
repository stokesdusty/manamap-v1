import supertest from 'supertest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createTestApp } from './helpers/app';

describe('Auth + Onboarding (e2e)', () => {
  let app: NestFastifyApplication;
  let req: ReturnType<typeof supertest>;

  const email = `auth-${Date.now()}@e2e.test`;
  let accessToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    req = supertest(app.getHttpServer());
  });

  afterAll(() => app.close());

  it('POST /auth/dev-login returns access + refresh tokens', async () => {
    const res = await req.post('/api/v1/auth/dev-login').send({ email }).expect(200);

    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(typeof res.body.accessToken).toBe('string');
    accessToken = res.body.accessToken as string;
  });

  it('GET /me shows new user with onboardedAt null', async () => {
    const res = await req
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.email).toBe(email);
    expect(res.body.onboardedAt).toBeNull();
  });

  it('POST /me/onboarding sets profile fields + onboardedAt', async () => {
    const res = await req
      .post('/api/v1/me/onboarding')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        displayName: 'E2E Alice',
        avatarColors: ['G'],
        formats: ['commander'],
      })
      .expect(200);

    expect(res.body.displayName).toBe('E2E Alice');
    expect(res.body.onboardedAt).not.toBeNull();
  });

  it('GET /me reflects onboarded state', async () => {
    const res = await req
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.displayName).toBe('E2E Alice');
    expect(res.body.formats).toContain('commander');
    expect(res.body.onboardedAt).not.toBeNull();
  });

  it('POST /auth/refresh rotates token pair', async () => {
    // Fresh login to get a new refresh token for this test
    const { body: t1 } = await req.post('/api/v1/auth/dev-login').send({ email }).expect(200);

    const res = await req
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: t1.refreshToken })
      .expect(200);

    expect(res.body).toHaveProperty('accessToken');
    expect(res.body.refreshToken).not.toBe(t1.refreshToken as string);
  });
});
