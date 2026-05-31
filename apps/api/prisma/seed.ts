import { PrismaClient } from '@prisma/client';

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

const STORES = [
  {
    name: 'Mox Boarding House',
    address: '5105 Leary Ave NW',
    timezone: 'America/Los_Angeles',
    city: 'Seattle',
    state: 'WA',
    zip: '98107',
    lat: 47.6665,
    lng: -122.3756,
  },
  {
    name: 'Card Kingdom',
    address: '6006 Roosevelt Way NE',
    city: 'Seattle',
    state: 'WA',
    zip: '98115',
    lat: 47.6729,
    lng: -122.3175,
  },
  {
    name: 'The Wandering Dragon',
    address: '123 Main St',
    city: 'Bellevue',
    state: 'WA',
    zip: '98004',
    lat: 47.6101,
    lng: -122.2015,
  },
];

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
  for (const s of STORES) {
    const existing = await prisma.store.findFirst({ where: { name: s.name } });
    if (!existing) {
      await prisma.$executeRaw`
        INSERT INTO stores (id, name, address, city, state, zip, geom, created_at, updated_at)
        VALUES (
          gen_random_uuid(),
          ${s.name},
          ${s.address},
          ${s.city},
          ${s.state},
          ${s.zip},
          ST_SetSRID(ST_MakePoint(${s.lng}, ${s.lat}), 4326)::geography,
          NOW(),
          NOW()
        )
      `;
    }
  }

  console.log('Seed complete.');
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
