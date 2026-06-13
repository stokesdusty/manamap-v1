// @ts-check
'use strict';

const { execSync } = require('child_process');
const path = require('path');

/** @type {() => Promise<void>} */
module.exports = async function globalSetup() {
  const dbUrl =
    process.env['TEST_DATABASE_URL'] ??
    process.env['DATABASE_URL'] ??
    'postgresql://manamap:manamap@localhost:5432/manamap_test';

  const apiDir = path.join(__dirname, '..');
  const env = {
    ...process.env,
    DATABASE_URL: dbUrl,
    NODE_ENV: 'test',
    THROTTLE_DISABLED: 'true',
    DEV_TOOLS: 'true',
    JWT_SECRET:
      process.env['JWT_SECRET'] ?? 'test-jwt-secret-minimum-32-characters-ok',
  };

  console.log(`\n[e2e] migrate deploy → ${dbUrl}`);
  execSync('npx prisma migrate deploy', { cwd: apiDir, env, stdio: 'inherit' });

  console.log('[e2e] seeding…');
  execSync('npx prisma db seed', { cwd: apiDir, env, stdio: 'inherit' });

  console.log('[e2e] ready\n');
};
