import supertest from 'supertest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createTestApp } from './helpers/app';

describe('Authorization guards (e2e)', () => {
  let app: NestFastifyApplication;
  let req: ReturnType<typeof supertest>;

  beforeAll(async () => {
    app = await createTestApp();
    req = supertest(app.getHttpServer());
  });

  afterAll(() => app.close());

  it('GET /me without token → 401', () => req.get('/api/v1/me').expect(401));

  it('GET /discovery/nearby without token → 401', () =>
    req.get('/api/v1/discovery/nearby').expect(401));

  it('Protected route with invalid Bearer token → 401', () =>
    req.get('/api/v1/me').set('Authorization', 'Bearer not-a-real-token').expect(401));

  it('GET /admin/moderation/stats as non-admin → 403', async () => {
    const { body } = await req
      .post('/api/v1/auth/dev-login')
      .send({ email: `authz-user-${Date.now()}@e2e.test` })
      .expect(200);

    await req
      .get('/api/v1/admin/moderation/stats')
      .set('Authorization', `Bearer ${body.accessToken as string}`)
      .expect(403);
  });
});
