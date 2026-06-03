// Injected into every Jest worker via setupFiles before any test code runs.
// Sets the env vars that NestJS ConfigModule reads on app bootstrap.

process.env['DATABASE_URL'] =
  process.env['TEST_DATABASE_URL'] ??
  process.env['DATABASE_URL'] ??
  'postgresql://manamap:manamap@localhost:5432/manamap_test';

process.env['REDIS_URL'] = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

process.env['JWT_SECRET'] =
  process.env['JWT_SECRET'] ?? 'test-jwt-secret-minimum-32-characters-ok';

process.env['NODE_ENV'] = 'test';
process.env['THROTTLE_DISABLED'] = 'true';
process.env['DEV_TOOLS'] = 'true';
