import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

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
  // Strip leading comment lines before parsing JSON
  const json = raw.replace(/^\/\/.*$/gm, '').trim();
  const stores: StoreRecord[] = JSON.parse(json);

  // Pre-fetch existing stores to distinguish created vs updated in one query
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

  console.log(`Stores: ${created} created, ${updated} updated (${stores.length} total)`);
}

seedStores()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
