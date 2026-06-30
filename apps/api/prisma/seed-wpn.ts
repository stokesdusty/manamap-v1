import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// WPN GraphQL API — discovered by inspecting network requests on locator.wizards.com
// Endpoint: https://api.tabletop.wizards.com/silverbeak-griffin-service/graphql
// No auth required. pageSize 1000 is the practical max before latency degrades.
// ---------------------------------------------------------------------------

const GRAPHQL_URL = 'https://api.tabletop.wizards.com/silverbeak-griffin-service/graphql';
const PAGE_SIZE = 1000;
const DELAY_MS = 400;

const QUERY = `
  query getStoresByLocation(
    $latitude: Float!
    $longitude: Float!
    $maxMeters: Int!
    $pageSize: Int
    $page: Int
  ) {
    storesByLocation(input: {
      latitude: $latitude
      longitude: $longitude
      maxMeters: $maxMeters
      pageSize: $pageSize
      page: $page
    }) {
      stores {
        id
        isPremium
        latitude
        longitude
        name
        postalAddress
        website
        phoneNumber
      }
      pageInfo {
        page
        pageSize
        totalResults
      }
    }
  }
`;

interface WpnStore {
  id: string;
  isPremium: boolean;
  latitude: number;
  longitude: number;
  name: string;
  postalAddress: string;
  website: string | null;
  phoneNumber: string | null;
}

interface PageInfo {
  page: number;
  pageSize: number;
  totalResults: number;
}

// Search centers: each covers a geographic region.
// Continental US 5000km radius also covers Alaska (Anchorage ~4400km away).
// Hawaii is ~6100km away and needs its own query.
const SEARCH_CENTERS = [
  { label: 'Continental US + Alaska + Canada', lat: 39.5, lng: -98.35, maxMeters: 5_000_000 },
  { label: 'Hawaii', lat: 21.3, lng: -157.8, maxMeters: 500_000 },
] as const;

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function fetchPage(
  lat: number,
  lng: number,
  maxMeters: number,
  page: number,
): Promise<{ stores: WpnStore[]; pageInfo: PageInfo }> {
  const res = await axios.post<{
    data: { storesByLocation: { stores: WpnStore[]; pageInfo: PageInfo } };
  }>(
    GRAPHQL_URL,
    {
      query: QUERY,
      variables: { latitude: lat, longitude: lng, maxMeters, pageSize: PAGE_SIZE, page },
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; ManaMapSeed/1.0)',
      },
      timeout: 30_000,
    },
  );
  return res.data.data.storesByLocation;
}

// Parses "616 8th Ave S, Seattle, WA, 98104, United States"
// Pattern (from end): country, zip, state, city, ...street parts
function parseAddress(raw: string): {
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string;
} | null {
  const parts = raw
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 4) return null;

  const country = parts[parts.length - 1];
  const zip = parts[parts.length - 2] || null;
  const state = parts[parts.length - 3] || null;
  const city = parts[parts.length - 4] || null;
  const address = parts.slice(0, parts.length - 4).join(', ') || null;

  return { address, city, state, zip, country };
}

function isAllowedCountry(country: string): boolean {
  const c = country.toLowerCase();
  return c.includes('united states') || c === 'usa' || c.includes('canada');
}

async function seedWpn(): Promise<void> {
  // Collect all unique WPN stores across search regions
  const byWpnId = new Map<string, WpnStore>();

  for (const center of SEARCH_CENTERS) {
    console.log(`\nFetching ${center.label}...`);
    const first = await fetchPage(center.lat, center.lng, center.maxMeters, 0);
    const totalPages = Math.ceil(first.pageInfo.totalResults / PAGE_SIZE);
    console.log(`  ${first.pageInfo.totalResults} total, ${totalPages} page(s)`);

    for (const s of first.stores) byWpnId.set(s.id, s);

    for (let page = 1; page < totalPages; page++) {
      await sleep(DELAY_MS);
      const result = await fetchPage(center.lat, center.lng, center.maxMeters, page);
      for (const s of result.stores) byWpnId.set(s.id, s);
      process.stdout.write(`  page ${page + 1}/${totalPages} — ${byWpnId.size} unique so far\r`);
    }
    console.log(`  Done — ${byWpnId.size} unique stores so far`);
  }

  console.log(`\nTotal unique WPN stores fetched: ${byWpnId.size}`);
  console.log('Upserting into database...\n');

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const wpn of byWpnId.values()) {
    // Skip if missing required fields
    if (!wpn.name?.trim() || !wpn.latitude || !wpn.longitude) {
      skipped++;
      continue;
    }

    const parsed = parseAddress(wpn.postalAddress);
    if (!parsed || !isAllowedCountry(parsed.country)) {
      skipped++;
      continue;
    }

    const fields = {
      name: wpn.name.trim(),
      address: parsed.address,
      city: parsed.city,
      state: parsed.state,
      zip: parsed.zip,
      website: wpn.website ?? null,
      wpnId: wpn.id,
    };

    let storeId: string;
    let isNew = false;

    // 1. Match by wpnId (fastest path — already imported before)
    const byWpnIdRow = await prisma.store.findUnique({
      where: { wpnId: wpn.id },
      select: { id: true },
    });

    if (byWpnIdRow) {
      await prisma.store.update({ where: { id: byWpnIdRow.id }, data: fields });
      storeId = byWpnIdRow.id;
    } else if (fields.city) {
      // 2. Match by name+city (manual seed may already have this store without a wpnId)
      const byNameCity = await prisma.store.findUnique({
        where: { name_city: { name: fields.name, city: fields.city } },
        select: { id: true },
      });

      if (byNameCity) {
        await prisma.store.update({ where: { id: byNameCity.id }, data: fields });
        storeId = byNameCity.id;
      } else {
        // 3. New store
        const created_ = await prisma.store.create({ data: fields, select: { id: true } });
        storeId = created_.id;
        isNew = true;
      }
    } else {
      // No city — just create (null city won't conflict on name_city unique)
      const created_ = await prisma.store.create({ data: fields, select: { id: true } });
      storeId = created_.id;
      isNew = true;
    }

    // Set PostGIS geometry
    await prisma.$executeRaw`
      UPDATE stores
      SET geom = ST_SetSRID(ST_MakePoint(${wpn.longitude}, ${wpn.latitude}), 4326)::geography
      WHERE id = ${storeId}
    `;

    if (isNew) created++;
    else updated++;

    const total = created + updated + skipped;
    if (total % 250 === 0) {
      console.log(
        `  [${total}/${byWpnId.size}] created=${created} updated=${updated} skipped=${skipped}`,
      );
    }
  }

  console.log(`\nFinished:`);
  console.log(`  ${created} created`);
  console.log(`  ${updated} updated`);
  console.log(`  ${skipped} skipped (missing name/coords or non-US/CA)`);
  console.log(`  ${byWpnId.size} total fetched from WPN`);
}

seedWpn()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
