// manamap — mock data. Attached to window.MM.
(function () {
  // Mana color identity keys: W U B R G
  const PLAYERS = [
    {
      id: 'p1', name: 'Wrenfield', handle: '@wren', initials: 'W',
      colors: ['U', 'B'], pronouns: 'they/them',
      formats: ['Commander', 'Cube'],
      commander: 'Yuriko, the Tenebrous Shadow',
      distance: 8, ble: true, metBefore: true, metAt: 'Dragon\u2019s Den',
      bio: 'Ninjas, theft, and politely winning before you knew the game started.',
      discord: 'wren_ninja',
      socials: [
        { platform: 'discord', value: 'wren_ninja', vis: 'public' },
        { platform: 'twitch', value: 'wrenfield', vis: 'public' },
        { platform: 'instagram', value: 'wren.mtg', vis: 'friends' },
        { platform: 'phone', value: '(206) 555-0199', vis: 'friends' },
        { platform: 'youtube', value: '@wrenninjas', vis: 'public' },
      ],
      decks: [
        { site: 'Moxfield', name: 'Yuriko Tempo', url: 'moxfield.com/u/wren' },
        { site: 'Archidekt', name: 'Dimir Mill', url: 'archidekt.com/u/wren' },
      ],
      power: '7', vibe: 'Casual-spicy',
    },
    {
      id: 'p2', name: 'Sol Ringer', handle: '@solring', initials: 'S',
      colors: ['R', 'W'], pronouns: 'he/him',
      formats: ['Commander', 'Modern'],
      commander: 'Winota, Joiner of Forces',
      distance: 14, ble: true, metBefore: false,
      bio: 'Aggro everything. If the game goes past turn 6 I\u2019ve already lost.',
      discord: 'solring',
      decks: [{ site: 'Archidekt', name: 'Boros Blitz', url: 'archidekt.com/u/sol' }],
      power: '8', vibe: 'Competitive',
    },
    {
      id: 'p3', name: 'Mossbrook', handle: '@moss', initials: 'M',
      colors: ['G'], pronouns: 'she/her',
      formats: ['Commander', 'Pauper'],
      commander: 'Azusa, Lost but Seeking',
      distance: 22, ble: true, metBefore: true, metAt: 'Top Deck Cafe',
      bio: 'Big mana, bigger creatures. Land enjoyer. Will trade snacks.',
      discord: 'mossbrook',
      decks: [{ site: 'Moxfield', name: 'Mono-G Stompy', url: 'moxfield.com/u/moss' }],
      power: '6', vibe: 'Casual',
    },
    {
      id: 'p4', name: 'Cinder', handle: '@cinder', initials: 'C',
      colors: ['B', 'R'], pronouns: 'they/them',
      formats: ['Commander', 'Draft'],
      commander: 'Kroxa, Titan of Death\u2019s Hunger',
      distance: 35, ble: true, metBefore: false,
      bio: 'Sacrifice synergies and a worrying amount of graveyard recursion.',
      discord: 'cinder.exe',
      decks: [{ site: 'Moxfield', name: 'Rakdos Sac', url: 'moxfield.com/u/cinder' }],
      power: '7', vibe: 'Casual-spicy',
    },
    {
      id: 'p5', name: 'Pearl', handle: '@pearl', initials: 'P',
      colors: ['W', 'U'], pronouns: 'she/her',
      formats: ['Commander'],
      commander: 'Dragonlord Ojutai',
      distance: 41, ble: true, metBefore: false,
      bio: 'Control, fliers, and saying \u201cin response\u201d a lot. Sorry in advance.',
      discord: 'pearl_azorius',
      decks: [{ site: 'Archidekt', name: 'Azorius Control', url: 'archidekt.com/u/pearl' }],
      power: '8', vibe: 'Competitive',
    },
    {
      id: 'p6', name: 'Birch', handle: '@birch', initials: 'B',
      colors: ['G', 'W', 'U'], pronouns: 'he/him',
      formats: ['Commander', 'Brawl'],
      commander: 'Chulane, Teller of Tales',
      distance: 52, ble: true, metBefore: false,
      bio: 'Value town. Bounce, draw, ramp, repeat. Everyone\u2019s favorite to hate.',
      discord: 'birchwood',
      decks: [{ site: 'Moxfield', name: 'Bant Bounce', url: 'moxfield.com/u/birch' }],
      power: '6', vibe: 'Casual',
    },
  ];

  // Incoming connection requests (people who scanned/pinged you)
  const REQUESTS = [
    { id: 'r1', playerId: 'p2', when: 'Just now', via: 'QR scan', note: 'gg earlier! lets get a pod going sat' },
    { id: 'r2', playerId: 'p5', when: '12m ago', via: 'Nearby', note: '' },
  ];

  // Already connected
  const CONNECTIONS = [
    { id: 'c1', playerId: 'p1', metAt: 'Dragon\u2019s Den', when: 'Last week' },
    { id: 'c2', playerId: 'p3', metAt: 'Top Deck Cafe', when: '3 weeks ago' },
  ];

  // The user's own card
  const ME = {
    name: 'Riffle',
    handle: '@riffle',
    initials: 'R',
    colors: ['U', 'R'],
    pronouns: 'they/them',
    formats: ['Commander', 'Modern'],
    commander: 'Niv-Mizzet, Parun',
    bio: 'Spellslinger. Draw a card, you draw a card, everyone takes 4.',
    discord: 'riffle_izzet',
    decks: [
      { site: 'Moxfield', name: 'Niv Spellslinger', url: 'moxfield.com/u/riffle' },
      { site: 'Archidekt', name: 'Izzet Storm', url: 'archidekt.com/u/riffle' },
    ],
    power: '7',
    vibe: 'Casual-spicy',
    homeStore: 'Dragon\u2019s Den',
    // Social card — vis: 'public' | 'friends' | 'hidden'
    socials: [
      { platform: 'discord', value: 'riffle_izzet', vis: 'public' },
      { platform: 'twitch', value: 'riffleplays', vis: 'public' },
      { platform: 'youtube', value: '@rifflemtg', vis: 'public' },
      { platform: 'instagram', value: 'riffle.exe', vis: 'friends' },
      { platform: 'xcom', value: 'riffle_mtg', vis: 'public' },
      { platform: 'website', value: 'riffle.gg', vis: 'public' },
      { platform: 'phone', value: '(206) 555-0148', vis: 'friends' },
      { platform: 'facebook', value: 'riffle.mtg', vis: 'hidden' },
    ],
    privacy: {
      showDiscord: true,
      showDecks: true,
      discoverable: true,
      showMetHistory: true,
    },
  };

  const MANA = {
    W: { name: 'White', fill: '#F2E6BE', ink: '#7A6A2E', ring: '#E4D199', letter: '#6E5E27' },
    U: { name: 'Blue',  fill: '#4FA9E6', ink: '#fff', ring: '#3F97D6', letter: '#fff' },
    B: { name: 'Black', fill: '#574F5E', ink: '#fff', ring: '#473F4E', letter: '#fff' },
    R: { name: 'Red',   fill: '#F0705B', ink: '#fff', ring: '#E25E4A', letter: '#fff' },
    G: { name: 'Green', fill: '#5FB97E', ink: '#fff', ring: '#4FA96E', letter: '#fff' },
  };

  const COMBO_NAMES = {
    'U,B': 'Dimir', 'R,W': 'Boros', 'W,R': 'Boros', 'B,R': 'Rakdos',
    'W,U': 'Azorius', 'U,R': 'Izzet', 'R,U': 'Izzet', 'G': 'Mono-Green',
    'W': 'Mono-White', 'U': 'Mono-Blue', 'B': 'Mono-Black', 'R': 'Mono-Red',
    'G,W,U': 'Bant', 'W,U,G': 'Bant', 'U,B,R': 'Grixis',
  };

  // Live "open to play now" sessions at the current store (LFG).
  // mins = minutes remaining; seats = how many more players they want.
  const LFG = [
    { playerId: 'p2', format: 'Commander', power: '8', mins: 42, seats: 2, note: 'Pod forming at table 4 — bring a fast deck' },
    { playerId: 'p3', format: 'Commander', power: '6', mins: 18, seats: 3, note: 'Chill precon-level pod, all welcome' },
    { playerId: 'p5', format: 'Commander', power: '8', mins: 51, seats: 1, note: '' },
    { playerId: 'p6', format: 'Brawl', power: '6', mins: 9, seats: 2, note: 'First to 2 wins, then switch' },
  ];

  // Host-created pods open at the store right now.
  // filledIds[0] is the host. requests = playerIds asking to join (host approves).
  const PODS = [
    { id: 'pod1', hostId: 'p5', format: 'Commander', targetPower: 8, tolerance: 1, seats: 4,
      filledIds: ['p5', 'p2'], requests: ['p6'], where: 'Table 4', mins: 38,
      note: 'High-power, but no game-ending combos before turn 6 please.' },
    { id: 'pod2', hostId: 'p3', format: 'Commander', targetPower: 6, tolerance: 2, seats: 4,
      filledIds: ['p3'], requests: [], where: 'Back-corner couches', mins: 22,
      note: 'Chill battlecruiser / upgraded precons. Snacks encouraged.' },
  ];

  // Logged games (confirmed). roster: [{id, deck}]; me is 'me'.
  const GAMES = [
    { id: 'g1', when: '2 days ago', store: 'Dragon\u2019s Den', format: 'Commander',
      roster: [{ id: 'me', deck: 'Niv-Mizzet, Parun' }, { id: 'p1', deck: 'Yuriko' }, { id: 'p3', deck: 'Azusa' }, { id: 'p5', deck: 'Ojutai' }],
      winnerId: 'me' },
    { id: 'g2', when: 'Last week', store: 'Dragon\u2019s Den', format: 'Commander',
      roster: [{ id: 'me', deck: 'Niv-Mizzet, Parun' }, { id: 'p2', deck: 'Winota' }, { id: 'p6', deck: 'Chulane' }],
      winnerId: 'p2' },
    { id: 'g3', when: 'Last week', store: 'Top Deck Cafe', format: 'Commander',
      roster: [{ id: 'me', deck: 'Izzet Storm' }, { id: 'p3', deck: 'Azusa' }, { id: 'p1', deck: 'Yuriko' }, { id: 'p4', deck: 'Kroxa' }],
      winnerId: 'me' },
    { id: 'g4', when: '2 weeks ago', store: 'Dragon\u2019s Den', format: 'Commander',
      roster: [{ id: 'me', deck: 'Niv-Mizzet, Parun' }, { id: 'p5', deck: 'Ojutai' }, { id: 'p6', deck: 'Chulane' }, { id: 'p3', deck: 'Azusa' }],
      winnerId: 'p5' },
  ];

  // Games someone else logged that include me, awaiting my confirmation.
  const PENDING_GAMES = [
    { id: 'pg1', loggedById: 'p1', when: '5m ago', store: 'Dragon\u2019s Den', format: 'Commander',
      roster: [{ id: 'me', deck: 'Niv-Mizzet, Parun' }, { id: 'p1', deck: 'Yuriko' }, { id: 'p3', deck: 'Azusa' }, { id: 'p5', deck: 'Ojutai' }],
      winnerId: 'p1' },
  ];

  // Notification inbox — history of pushes. kind drives icon/color + tap target.
  const NOTIFS = [
    { id: 'n1', kind: 'request', playerId: 'p2', title: 'New connect request', body: 'Sol Ringer wants to connect', when: '2m ago', unread: true },
    { id: 'n2', kind: 'game_confirm', playerId: 'p1', title: 'Confirm your game', body: 'Wrenfield logged a Commander game — you won', when: '6m ago', unread: true },
    { id: 'n3', kind: 'nearby', playerId: 'p5', title: 'A player you’ve met is here', body: 'Pearl just checked in at Dragon’s Den', when: '20m ago', unread: true },
    { id: 'n4', kind: 'accept', playerId: 'p3', title: 'Connection accepted', body: 'Mossbrook accepted your request', when: '1h ago', unread: false },
    { id: 'n5', kind: 'pod', playerId: 'p2', title: 'Pod is full', body: 'Your Commander pod at Dragon’s Den is ready — table 4', when: '3h ago', unread: false },
    { id: 'n6', kind: 'event', title: 'Friday Commander starts soon', body: 'Starts in an hour at Dragon’s Den', when: '5h ago', unread: false },
    { id: 'n7', kind: 'broadcast', title: 'Dragon’s Den', body: 'Singles sale today — 20% off Commander staples!', when: 'Yesterday', unread: false },
    { id: 'n8', kind: 'quest', title: 'Quest complete', body: 'You finished “Meet 3 new players” — badge earned', when: 'Yesterday', unread: false },
  ];

  // Monthly quests — data-driven, progress-tracked. (mirrors badge criteria)
  const QUESTS = [
    { id: 'q1', icon: 'user', title: 'Meet 3 new players', sub: 'Connect with players you haven’t met', progress: 2, goal: 3, reward: 'Socialite badge' },
    { id: 'q2', icon: 'pin', title: 'Try a new store', sub: 'Check in somewhere new this month', progress: 0, goal: 1, reward: 'Explorer badge' },
    { id: 'q3', icon: 'cards', title: 'Play 5 games', sub: 'Log 5 games at any store', progress: 5, goal: 5, reward: 'Regular badge', done: true },
    { id: 'q4', icon: 'flame', title: '3-week check-in streak', sub: 'Check in 3 weeks running', progress: 2, goal: 3, reward: 'Devoted badge' },
  ];

  // Friend-streaks — repeated play with the same person (not just same store).
  const FRIEND_STREAKS = [
    { id: 'fs1', playerId: 'p1', games: 6, lastPlayed: '2 days ago', record: '4–2', hot: true },
    { id: 'fs2', playerId: 'p3', games: 4, lastPlayed: 'Last week', record: '1–3', hot: true },
    { id: 'fs3', playerId: 'p5', games: 2, lastPlayed: '2 weeks ago', record: '1–1', hot: false },
  ];

  // Today's events at the active store
  const TODAY_EVENTS = [
    { id: 'e1', name: 'Friday Commander', format: 'Commander', time: '6:00 PM', source: 'STORE', attending: true },
    { id: 'e2', name: 'Draft Night', format: 'Draft', time: '7:30 PM', source: 'DISCORD', attending: false },
    { id: 'e3', name: 'Modern Showdown', format: 'Modern', time: '8:00 PM', source: 'WIZARDS', attending: false },
  ];

  // Store map data
  const STORES = [
    { id: 's1', name: 'Dragon\u2019s Den', address: '114 Market St', city: 'Riverton', state: 'WA', status: 'ACTIVE', discord: true, x: 47, y: 41 },
    { id: 's2', name: 'Top Deck Cafe', address: '220 Pine Ave', city: 'Riverton', state: 'WA', status: 'ACTIVE', x: 58, y: 56 },
    { id: 's3', name: 'The Sideboard', address: '8 Commerce Blvd', city: 'Eastvale', state: 'WA', status: 'ACTIVE', x: 34, y: 67 },
    { id: 's4', name: 'Mana Vault Games', address: '501 Tower Rd', city: 'Northgate', state: 'WA', status: 'ACTIVE', x: 65, y: 33 },
    { id: 's5', name: 'Gilded Goblin', address: '33 Heritage Lane', city: 'Old Town', state: 'WA', status: 'ACTIVE', x: 27, y: 51 },
    { id: 's6', name: 'The Wizard\u2019s Chest', address: '77 North Plaza', city: 'Riverton', state: 'WA', status: 'PROPOSED', x: 52, y: 47, confirmCount: 1 },
  ];

  const STORE_SCHEDULE = {
    s1: [
      { date: 'Today', events: [
        { id: 'se1', name: 'Friday Commander', format: 'Commander', time: '6:00 PM', source: 'STORE', attendeeCount: 8, hereNowCount: 3, isAttending: true, hasChannel: true },
        { id: 'se2', name: 'Draft Night', format: 'Draft', time: '7:30 PM', source: 'DISCORD', attendeeCount: 12, hereNowCount: 0, isAttending: false },
      ]},
      { date: 'Saturday', events: [
        { id: 'se3', name: 'Modern Showdown', format: 'Modern', time: '1:00 PM', source: 'WIZARDS', attendeeCount: 6, hereNowCount: 0, isAttending: false },
        { id: 'se4', name: 'Saturday Commander', format: 'Commander', time: '5:00 PM', source: 'STORE', attendeeCount: 4, hereNowCount: 0, isAttending: false },
      ]},
      { date: 'Sunday', events: [
        { id: 'se5', name: 'Sunday Funday', format: 'Casual', time: '2:00 PM', source: 'STORE', attendeeCount: 3, hereNowCount: 0, isAttending: false },
      ]},
    ],
    s2: [
      { date: 'Today', events: [
        { id: 'se6', name: 'Pauper Night', format: 'Pauper', time: '7:00 PM', source: 'STORE', attendeeCount: 5, hereNowCount: 0, isAttending: false },
      ]},
    ],
  };

  const STORE_LEADERBOARD = {
    s1: [
      { rank: 1, name: 'Wrenfield', streak: 8, total: 24, isMe: false, colors: ['U','B'] },
      { rank: 2, name: 'Sol Ringer', streak: 5, total: 18, isMe: false, colors: ['R','W'] },
      { rank: 3, name: 'Mossbrook', streak: 3, total: 15, isMe: false, colors: ['G'] },
      { rank: 4, name: 'Riffle', streak: 2, total: 12, isMe: true, colors: ['U','R'] },
      { rank: 5, name: 'Pearl', streak: 4, total: 11, isMe: false, colors: ['W','U'] },
    ],
  };

  const STORE_OFFERS = {
    s1: [
      { id: 'o1', type: 'FIRST_VISIT', title: 'First visit bonus', description: '10% off singles or sealed. Show staff your badge to redeem.' },
      { id: 'o2', type: 'STREAK', streakRequired: 4, title: '4-week streak reward', description: 'Free draft pack after 4 consecutive weekly check-ins.' },
    ],
  };

  const EVENT_ATTENDEES = {
    se1: {
      hereNow: [
        { id: 'p2', name: 'Sol Ringer', colors: ['R','W'] },
        { id: 'p5', name: 'Pearl', colors: ['W','U'] },
        { id: 'p1', name: 'Wrenfield', colors: ['U','B'] },
      ],
      rsvpd: [
        { id: 'p3', name: 'Mossbrook', colors: ['G'] },
        { id: 'p6', name: 'Birch', colors: ['G','W','U'] },
      ],
    },
  };

  // Encounter history (deduplicated per peer, most recent wins)
  const ENCOUNTERS = [
    { id: 'enc1', peer: { id: 'p2', name: 'Sol Ringer', colors: ['R','W'], commander: 'Winota, Joiner of Forces' }, source: 'GAME', storeName: 'Dragon\u2019s Den', createdAt: new Date(Date.now() - 1000*60*30).toISOString() },
    { id: 'enc2', peer: { id: 'p1', name: 'Wrenfield', colors: ['U','B'], commander: 'Yuriko, the Tiger\u2019s Shadow' }, source: 'CONNECTION', storeName: 'Dragon\u2019s Den', createdAt: new Date(Date.now() - 1000*60*90).toISOString() },
    { id: 'enc3', peer: { id: 'p5', name: 'Pearl', colors: ['W','U'], commander: 'Dragonlord Ojutai' }, source: 'PRESENCE', storeName: 'Dragon\u2019s Den', createdAt: new Date(Date.now() - 1000*60*60*3).toISOString() },
    { id: 'enc4', peer: { id: 'p3', name: 'Mossbrook', colors: ['G'], commander: 'Azusa, Lost but Seeking' }, source: 'GAME', storeName: 'Top Deck Cafe', createdAt: new Date(Date.now() - 1000*60*60*48).toISOString() },
    { id: 'enc5', peer: { id: 'p4', name: 'Cinder', colors: ['B','R'], commander: 'Kroxa, Titan of Death\u2019s Hunger' }, source: 'PRESENCE', storeName: 'Dragon\u2019s Den', createdAt: new Date(Date.now() - 1000*60*60*50).toISOString() },
    { id: 'enc6', peer: { id: 'p6', name: 'Birch', colors: ['G','W','U'], commander: 'Chulane, Teller of Tales' }, source: 'CONNECTION', storeName: 'Top Deck Cafe', createdAt: new Date(Date.now() - 1000*60*60*24*10).toISOString() },
  ];
  // Crossed-paths count: PRESENCE encounters whose peer isn't connected yet
  const connectedIds = new Set(CONNECTIONS.map(c => c.playerId));
  const CROSSED_PATHS_COUNT = ENCOUNTERS.filter(e => e.source === 'PRESENCE' && !connectedIds.has(e.peer.id)).length;

  window.MM = { PLAYERS, REQUESTS, CONNECTIONS, ME, MANA, COMBO_NAMES, LFG, PODS, GAMES, PENDING_GAMES, NOTIFS, QUESTS, FRIEND_STREAKS, TODAY_EVENTS, STORES, STORE_SCHEDULE, STORE_LEADERBOARD, STORE_OFFERS, EVENT_ATTENDEES, ENCOUNTERS, CROSSED_PATHS_COUNT,
    byId(id) { return PLAYERS.find(p => p.id === id); } };
})();
