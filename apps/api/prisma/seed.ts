import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

const FORMATS = [
  { name: 'Standard', slug: 'standard' },
  { name: 'Pioneer', slug: 'pioneer' },
  { name: 'Modern', slug: 'modern' },
  { name: 'Legacy', slug: 'legacy' },
  { name: 'Vintage', slug: 'vintage' },
  { name: 'Commander', slug: 'commander' },
  { name: 'Draft', slug: 'draft' },
];

const USERS = [
  { displayName: 'Alice Chen', email: 'ghalta@example.com', avatarColors: ['G'] },
  { displayName: 'Bob Tanaka', email: 'marchesa@example.com', avatarColors: ['U', 'B', 'R'] },
  { displayName: 'Carol Díaz', email: 'giada@example.com', avatarColors: ['W'] },
  { displayName: 'Dave Okafor', email: 'krenko@example.com', avatarColors: ['R'] },
  { displayName: 'Eve Johansson', email: 'tatyova@example.com', avatarColors: ['U', 'G'] },
];

const BADGES = [
  {
    code: 'first_checkin',
    name: 'First Steps',
    description: 'Check in to any store for the first time',
    icon: '🎯',
    criteria: { type: 'first_checkin' },
  },
  {
    code: 'store_regular',
    name: 'Store Regular',
    description: 'Check in to the same store 5 times',
    icon: '🏪',
    criteria: { type: 'store_total', count: 5 },
  },
  {
    code: 'devoted_local',
    name: 'Devoted Local',
    description: 'Maintain a 4-week check-in streak at any store',
    icon: '⚔️',
    criteria: { type: 'streak', length: 4 },
  },
  {
    code: 'explorer',
    name: 'Store Explorer',
    description: 'Check in to 3 different stores',
    icon: '🗺️',
    criteria: { type: 'unique_stores', count: 3 },
  },
  {
    code: 'centurion',
    name: 'Centurion',
    description: 'Log 100 check-ins total',
    icon: '💯',
    criteria: { type: 'global_total', count: 100 },
  },
];

interface StoreRecord {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
  timezone?: string;
  discordUrl?: string;
  website?: string;
}

async function seedStores(): Promise<void> {
  const raw = readFileSync(join(__dirname, 'data', 'stores.json'), 'utf-8');
  const json = raw.replace(/^\/\/.*$/gm, '').trim();
  const stores: StoreRecord[] = JSON.parse(json);

  const existing = await prisma.store.findMany({
    where: { OR: stores.map((s) => ({ name: s.name, city: s.city })) },
    select: { name: true, city: true },
  });
  const existingKeys = new Set(existing.map((e) => `${e.name}|||${e.city}`));

  let created = 0;
  let updated = 0;

  for (const s of stores) {
    const isNew = !existingKeys.has(`${s.name}|||${s.city}`);

    const store = await prisma.store.upsert({
      where: { name_city: { name: s.name, city: s.city } },
      update: {
        address: s.address,
        state: s.state,
        zip: s.zip,
        timezone: s.timezone ?? null,
        website: s.website ?? null,
        discordUrl: s.discordUrl ?? null,
      },
      create: {
        name: s.name,
        address: s.address,
        city: s.city,
        state: s.state,
        zip: s.zip,
        timezone: s.timezone ?? null,
        website: s.website ?? null,
        discordUrl: s.discordUrl ?? null,
      },
    });

    await prisma.$executeRaw`
      UPDATE stores
      SET geom = ST_SetSRID(ST_MakePoint(${s.lng}, ${s.lat}), 4326)::geography
      WHERE id = ${store.id}
    `;

    if (isNew) created++;
    else updated++;
  }

  console.log(`Stores: ${created} created, ${updated} updated`);
}

async function main(): Promise<void> {
  console.log('Seeding formats…');
  for (const fmt of FORMATS) {
    await prisma.format.upsert({
      where: { slug: fmt.slug },
      update: {},
      create: fmt,
    });
  }

  console.log('Seeding users…');
  for (const u of USERS) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        ...u,
        privacySettings: { create: {} },
        identities: {
          create: {
            provider: 'apple',
            providerId: `fake_apple_${u.email.split('@')[0]}`,
          },
        },
      },
    });
  }

  console.log('Seeding stores (with PostGIS geometry)…');
  await seedStores();

  console.log('Seeding badges…');
  for (const b of BADGES) {
    await prisma.badge.upsert({
      where: { code: b.code },
      update: { name: b.name, description: b.description, icon: b.icon, criteria: b.criteria },
      create: b,
    });
  }

  console.log('Seed complete.');
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
