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

// Stable dev bot accounts — IDs are fixed strings for easy reference.
// See CLAUDE.md for the full list and field details.
const BOTS = [
  {
    id: 'bot_wren',
    displayName: 'Wren',
    email: 'bot.wren@manamap.dev',
    avatarColors: ['W', 'U'],
    formats: ['commander'],
    powerLevel: 7,
    vibes: ['casual'],
    bio: 'Bot pilot. Commander only.',
  },
  {
    id: 'bot_sol',
    displayName: 'Sol',
    email: 'bot.sol@manamap.dev',
    avatarColors: ['R'],
    formats: ['modern'],
    powerLevel: 8,
    vibes: ['spike'],
    bio: 'Fast mana. Faster wins.',
  },
  {
    id: 'bot_kira',
    displayName: 'Kira',
    email: 'bot.kira@manamap.dev',
    avatarColors: ['U', 'B'],
    formats: ['pioneer'],
    powerLevel: 6,
    vibes: ['johnny'],
    bio: 'Combo or bust.',
  },
  {
    id: 'bot_dune',
    displayName: 'Dune',
    email: 'bot.dune@manamap.dev',
    avatarColors: ['G', 'W'],
    formats: ['standard'],
    powerLevel: 5,
    vibes: ['casual'],
    bio: 'Stompy beatdown.',
  },
  {
    id: 'bot_ash',
    displayName: 'Ash',
    email: 'bot.ash@manamap.dev',
    avatarColors: ['B'],
    formats: ['legacy'],
    powerLevel: 9,
    vibes: ['competitive'],
    bio: 'Storm clouds incoming.',
  },
  {
    id: 'bot_nyx',
    displayName: 'Nyx',
    email: 'bot.nyx@manamap.dev',
    avatarColors: ['U'],
    formats: ['commander', 'modern'],
    powerLevel: 7,
    vibes: ['vorthos'],
    bio: 'Thematic builds only.',
  },
  {
    id: 'bot_tarn',
    displayName: 'Tarn',
    email: 'bot.tarn@manamap.dev',
    avatarColors: ['R', 'G'],
    formats: ['draft'],
    powerLevel: 4,
    vibes: ['timmy'],
    bio: 'Big monsters, big fun.',
  },
  {
    id: 'bot_vex',
    displayName: 'Vex',
    email: 'bot.vex@manamap.dev',
    avatarColors: ['U', 'R'],
    formats: ['commander', 'pioneer'],
    powerLevel: 6,
    vibes: ['johnny'],
    bio: 'Jank that somehow works.',
  },
];

// Quest reward badges — criteria type 'quest_reward' is intentionally ignored by
// the gamification evaluator; these are only awarded when a quest completes.
const QUEST_REWARD_BADGES = [
  {
    code: 'social_butterfly',
    name: 'Social Butterfly',
    description: 'Met 3 new players in a single month',
    icon: '🦋',
    criteria: { type: 'quest_reward' },
  },
  {
    code: 'wanderer',
    name: 'Wanderer',
    description: 'Tried a store you had never visited before',
    icon: '🧭',
    criteria: { type: 'quest_reward' },
  },
  {
    code: 'battle_hardened',
    name: 'Battle Hardened',
    description: 'Played 5 confirmed games in a single month',
    icon: '⚔️',
    criteria: { type: 'quest_reward' },
  },
  {
    code: 'true_regular',
    name: 'True Regular',
    description: 'Maintained a 3-week check-in streak',
    icon: '🔥',
    criteria: { type: 'quest_reward' },
  },
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

  console.log('Seeding dev bots…');
  for (const b of BOTS) {
    await prisma.user.upsert({
      where: { email: b.email },
      update: { isBot: true, formats: b.formats, powerLevel: b.powerLevel, vibes: b.vibes, bio: b.bio, avatarColors: b.avatarColors },
      create: {
        id: b.id,
        displayName: b.displayName,
        email: b.email,
        avatarColors: b.avatarColors,
        formats: b.formats,
        powerLevel: b.powerLevel,
        vibes: b.vibes,
        bio: b.bio,
        isBot: true,
        onboardedAt: new Date(),
        privacySettings: {
          create: { discoverable: true },
        },
        identities: {
          create: {
            provider: 'discord',
            providerId: `bot_${b.id}`,
            discordHandle: b.displayName.toLowerCase(),
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

  console.log('Seeding quest reward badges…');
  for (const b of QUEST_REWARD_BADGES) {
    await prisma.badge.upsert({
      where: { code: b.code },
      update: { name: b.name, description: b.description, icon: b.icon, criteria: b.criteria },
      create: b,
    });
  }

  console.log('Seeding monthly quests…');
  // Quests are scoped to calendar months (UTC). Add next month's quests here when
  // rolling over. To add a new quest type: insert a row here with the new criteria
  // JSON — no code deploy needed.
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const rewardBadges = await prisma.badge.findMany({
    where: { code: { in: QUEST_REWARD_BADGES.map((b) => b.code) } },
    select: { id: true, code: true },
  });
  const badgeIdByCode = new Map(rewardBadges.map((b) => [b.code, b.id]));

  const QUESTS = [
    {
      code: `meet_new_players_${monthStart.toISOString().slice(0, 7)}`,
      title: 'Meet 3 New Players',
      description: 'Accept or send 3 new connections this month',
      icon: '🤝',
      criteria: { type: 'meet_new_players', count: 3 },
      rewardBadgeCode: 'social_butterfly',
    },
    {
      code: `new_store_${monthStart.toISOString().slice(0, 7)}`,
      title: 'Try a New Store',
      description: 'Check in to a store you have never visited before',
      icon: '🗺️',
      criteria: { type: 'new_store' },
      rewardBadgeCode: 'wanderer',
    },
    {
      code: `play_games_${monthStart.toISOString().slice(0, 7)}`,
      title: 'Play 5 Games',
      description: 'Complete 5 confirmed game logs this month',
      icon: '⚔️',
      criteria: { type: 'play_games', count: 5 },
      rewardBadgeCode: 'battle_hardened',
    },
    {
      code: `checkin_streak_${monthStart.toISOString().slice(0, 7)}`,
      title: '3-Week Streak',
      description: 'Maintain a 3-week check-in streak at any store',
      icon: '🔥',
      criteria: { type: 'checkin_streak', length: 3 },
      rewardBadgeCode: 'true_regular',
    },
  ];

  for (const q of QUESTS) {
    const rewardBadgeId = badgeIdByCode.get(q.rewardBadgeCode) ?? null;
    await prisma.quest.upsert({
      where: { code: q.code },
      update: { title: q.title, description: q.description, icon: q.icon, criteria: q.criteria, activeFrom: monthStart, activeTo: monthEnd, rewardBadgeId },
      create: {
        code: q.code,
        title: q.title,
        description: q.description,
        icon: q.icon,
        criteria: q.criteria,
        activeFrom: monthStart,
        activeTo: monthEnd,
        ...(rewardBadgeId ? { rewardBadgeId } : {}),
      },
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
