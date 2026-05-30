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

  window.MM = { PLAYERS, REQUESTS, CONNECTIONS, ME, MANA, COMBO_NAMES,
    byId(id) { return PLAYERS.find(p => p.id === id); } };
})();
