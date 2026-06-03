import supertest from 'supertest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createTestApp } from './helpers/app';

// Mox Boarding House – Seattle (from seed data)
const MOX_LAT = 47.6665;
const MOX_LNG = -122.3756;

// Portland, OR – ~280 km from the store, well outside the 250 m radius
const FAR_LAT = 45.5231;
const FAR_LNG = -122.6765;

describe('Check-in proximity (e2e)', () => {
  let app: NestFastifyApplication;
  let req: ReturnType<typeof supertest>;
  let accessToken: string;
  let storeId: string;

  beforeAll(async () => {
    app = await createTestApp();
    req = supertest(app.getHttpServer());

    const { body: tokens } = await req
      .post('/api/v1/auth/dev-login')
      .send({ email: `checkin-${Date.now()}@e2e.test` })
      .expect(200);
    accessToken = tokens.accessToken as string;

    // Resolve the seeded Mox Boarding House store ID
    const { body: stores } = await req
      .get('/api/v1/stores?q=Mox+Boarding')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    storeId = (stores as Array<{ id: string }>)[0].id;
  });

  afterAll(() => app.close());

  it('Checkin at store coordinates → 200 with streak + badges', async () => {
    const res = await req
      .post(`/api/v1/stores/${storeId}/checkin`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ lat: MOX_LAT, lng: MOX_LNG, accuracy: 10 })
      .expect(200);

    expect(res.body).toHaveProperty('checkinId');
    expect(res.body).toHaveProperty('streak');
    expect(res.body).toHaveProperty('newBadges');
  });

  it('Checkin from far away → 422 with code too_far', async () => {
    const res = await req
      .post(`/api/v1/stores/${storeId}/checkin`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ lat: FAR_LAT, lng: FAR_LNG, accuracy: 10 })
      .expect(422);

    expect(res.body.code).toBe('too_far');
    expect(res.body).toHaveProperty('distanceMeters');
  });
});
