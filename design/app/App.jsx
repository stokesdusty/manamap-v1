// manamap — App shell: router, tabs, transitions, state. Mounts #root.
const {
  Icon, IOSDevice, DiscoverScreen, QRSheet, PreviewScreen, ConnectedScreen, ConnectionDetailScreen,
  ConnectScreen, ProfileScreen, OnboardingFlow, LFGComposer, PodSheet,
  PodsSection, PodCreateSheet, PodScreen,
  gameStats, GameStatsStrip, RecentGames, ConfirmGamesSection, LogGameFlow,
  NotificationsInbox, QuestsCard, FriendStreaks,
  manaAccent, manaAccent2, identityGradient, readableOn, comboName,
  useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakColor, TweakSelect,
  HomeScreen, WalkthroughOverlay, StoresScreen, HistoryScreen, LifeTrackerScreen,
  PlayOnlineSheet,
} = window;
const MM = window.MM;
const { useState, useRef, useEffect, useCallback } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "startView": "onboarding",
  "cardStyle": "profile",
  "theme": "dusk",
  "accentMode": "identity",
  "brand": "#5AA452",
  "font": "Plus Jakarta Sans"
}/*EDITMODE-END*/;

const THEMES = {
  soft:  { label: 'Soft paper' },
  pop:   { label: 'Bright pop' },
  dusk:  { label: 'Dusk' },
};

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [tab, setTab] = useState('home');
  const [stack, setStack] = useState([]);     // [{type, player, meta}]
  const [leaving, setLeaving] = useState(false);
  const [qr, setQr] = useState(false);
  const [toast, setToast] = useState(null);

  const [requests, setRequests] = useState(MM.REQUESTS);
  const [connections, setConnections] = useState(MM.CONNECTIONS);
  const [sentSet, setSentSet] = useState(() => new Set());
  const [privacy, setPrivacy] = useState(MM.ME.privacy);
  const [view, setView] = useState(() => (TWEAK_DEFAULTS.startView === 'app' ? 'app' : 'onboarding'));
  const [walkthrough, setWalkthrough] = useState(false);
  const scrollRef = useRef(null);

  // let the Tweak drive which view shows (replay onboarding on demand)
  useEffect(() => { setView(t.startView === 'app' ? 'app' : 'onboarding'); }, [t.startView]);

  // fit device to viewport
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => setScale(Math.min((window.innerWidth - 24) / 402, (window.innerHeight - 24) / 874, 1.12));
    fit(); window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  // entrance state for pushed screen — drive via state (not CSS anim) so the
  // resting position never depends on an animation actually running.

  // LFG ("open to play now")
  const [lfgOpen, setLfgOpen] = useState(false);
  const [lfgSession, setLfgSession] = useState(null);
  const [lfgSheet, setLfgSheet] = useState(null); // null | 'compose' | 'edit'

  // Pods
  const [pods, setPods] = useState(MM.PODS);
  const [podCreate, setPodCreate] = useState(false);

  // Games
  const [games, setGames] = useState(MM.GAMES);
  const [pendingGames, setPendingGames] = useState(MM.PENDING_GAMES);
  const [logSheet, setLogSheet] = useState(null); // null | { pod }

  // Notifications
  const [notifs, setNotifs] = useState(MM.NOTIFS);
  const [inbox, setInbox] = useState(false);
  const notifUnread = notifs.filter(n => n.unread).length;

  // Player identity — the colors chosen at signup drive the whole color scheme.
  const [meColors, setMeColors] = useState(MM.ME.colors);
  const [meSocials, setMeSocials] = useState(MM.ME.socials);
  const [socialSheet, setSocialSheet] = useState(false);
  const [playOnlineOpen, setPlayOnlineOpen] = useState(false);
  const me = { ...MM.ME, colors: meColors, socials: meSocials };
  const identBrand = manaAccent(meColors);
  const identBrand2 = manaAccent2(meColors);
  const brand = t.accentMode === 'manual' ? t.brand : identBrand;
  const brand2 = t.accentMode === 'manual' ? t.brand : identBrand2;
  const identGrad = t.accentMode === 'manual'
    ? `linear-gradient(135deg, ${t.brand}, ${t.brand})`
    : identityGradient(meColors);

  const variant = t.cardStyle;

  const push = useCallback((entry) => {
    setStack(s => [...s, entry]);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, []);
  const pop = useCallback(() => {
    setLeaving(true);
    setTimeout(() => { setLeaving(false); setStack(s => s.slice(0, -1)); }, 260);
  }, []);
  const clearStack = useCallback(() => setStack([]), []);

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2200); };

  // LFG handlers
  const publishLfg = (s) => { setLfgSession(s); setLfgOpen(true); setLfgSheet(null); flash(lfgSheet === 'edit' ? 'Status updated' : 'You’re open to play!'); };
  const stopLfg = () => { setLfgOpen(false); setLfgSession(null); flash('You’re no longer open'); };

  // Pod handlers
  const openPod = (pod) => push({ type: 'pod', pod, isHost: pod.hostId === 'me' });
  const createPod = (pod) => { setPods(ps => [pod, ...ps.filter(p => p.id !== 'mine')]); setPodCreate(false); push({ type: 'pod', pod, isHost: true }); flash('Pod created'); };

  // Game handlers
  const submitGame = (g) => { setGames(gs => [{ id: 'g-' + Date.now(), when: 'Just now', ...g }, ...gs]); setLogSheet(null); flash('Game logged — players notified to confirm'); };
  const confirmGame = (g) => { setPendingGames(ps => ps.filter(x => x.id !== g.id)); setGames(gs => [{ ...g, when: g.when }, ...gs]); flash('Result confirmed'); };
  const disputeGame = (g) => { setPendingGames(ps => ps.filter(x => x.id !== g.id)); flash('Result disputed'); };
  const myStats = gameStats(games);

  // Notification handlers
  const markAllRead = () => setNotifs(ns => ns.map(n => ({ ...n, unread: false })));
  const tapNotif = (n) => {
    setNotifs(ns => ns.map(x => x.id === n.id ? { ...x, unread: false } : x));
    setInbox(false);
    if (n.kind === 'request' || n.kind === 'game_confirm') { clearStack(); setTab('connect'); }
    else if (n.kind === 'nearby') { clearStack(); setTab('discover'); }
    else if (n.playerId) { push({ type: 'preview', player: MM.byId(n.playerId) }); }
  };

  // actions
  const sendRequest = (p) => { setSentSet(s => new Set(s).add(p.id)); flash(`Request sent to ${p.name}`); };
  const acceptReq = (r) => {
    const p = MM.byId(r.playerId);
    setRequests(rs => rs.filter(x => x.id !== r.id));
    setConnections(cs => [{ id: 'new-' + r.id, playerId: r.playerId, metAt: 'Dragon’s Den', when: 'Just now' }, ...cs]);
    push({ type: 'connected', player: p });
  };
  const declineReq = (r) => { setRequests(rs => rs.filter(x => x.id !== r.id)); flash('Request declined'); };
  const openConn = (c) => push({ type: 'connDetail', player: MM.byId(c.playerId), meta: c });
  const togglePrivacy = (k) => setPrivacy(pv => ({ ...pv, [k]: !pv[k] }));

  const simulateScan = () => {
    const candidate = MM.PLAYERS.find(p => !sentSet.has(p.id) && !connections.some(c => c.playerId === p.id)) || MM.PLAYERS[3];
    setQr(false);
    setTimeout(() => push({ type: 'preview', player: candidate }), 120);
  };

  // theme application
  const rootRef = useRef(null);

  const top = stack[stack.length - 1];
  const reqCount = requests.length;

  // header config
  const tabTitles = { home: 'Home', discover: 'Discover', connect: 'Connect', you: 'You' };
  const stackTitles = { preview: top && top.player && top.player.name, connected: 'Connected', connDetail: top && top.player && top.player.name, pod: top && top.type === 'pod' ? (top.isHost ? 'Manage pod' : 'Pod') : '', stores: 'Stores', history: 'History', lifetracker: 'Life Tracker' };

  const appBody = (
    <div ref={rootRef} data-theme={t.theme} style={{
      '--brand': brand, '--brand-2': brand2, '--on-brand': readableOn(brand),
      '--identity-grad': identGrad,
      '--font': `'${t.font}', system-ui, sans-serif`,
      fontFamily: `'${t.font}', system-ui, sans-serif`, color: 'var(--ink)',
      height: '100%', display: 'flex', flexDirection: 'column',
      position: 'relative', zIndex: 0, isolation: 'isolate', overflow: 'hidden',
      background: 'var(--bg)',
    }}>
      {/* ── Header (root = active tab; hidden on Home — banner owns the safe-area) ── */}
      {tab !== 'home' && (
        <Header
          backable={false}
          title={tabTitles[tab]}
          big={true}
          onBack={pop}
          notifUnread={notifUnread}
          onBell={() => setInbox(true)}
        />
      )}

      {/* ── Scroll content (root tabs) ── */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', position: 'relative' }}>
        {tab === 'home' && <HomeScreen
          me={me} connections={connections} requests={requests}
          pendingGames={pendingGames} games={games} quests={MM.QUESTS}
          pods={pods} notifUnread={notifUnread}
          lfg={{ open: lfgOpen, session: lfgSession, sessions: MM.LFG, onGoOpen: () => setLfgSheet('compose') }}
          onTab={(t) => { clearStack(); setTab(t); }}
          onLogGame={() => setLogSheet({ pod: null })}
          onBell={() => setInbox(true)}
          onOpenStores={(id) => push({ type: 'stores', storeId: id || null })}
          onOpenHistory={() => push({ type: 'history' })}
        />}
        {tab === 'discover' && <DiscoverScreen players={MM.PLAYERS} me={me} onOpen={p => push({ type: 'preview', player: p })} sentSet={sentSet} onShowCode={() => setQr(true)} lfg={{
          open: lfgOpen, session: lfgSession, sessions: MM.LFG,
          onGoOpen: () => setLfgSheet('compose'), onEdit: () => setLfgSheet('edit'), onStop: stopLfg,
        }} pods={{ list: pods, me: me, onOpenPod: openPod, onStart: () => setPodCreate(true) }} />}
        {tab === 'connect' && <ConnectScreen requests={requests} connections={connections} onAccept={acceptReq} onDecline={declineReq} onOpenConn={openConn} pending={pendingGames} me={me} onConfirmGame={confirmGame} onDisputeGame={disputeGame} />}
        {tab === 'you' && <ProfileScreen me={me} variant={variant} privacy={privacy} onTogglePrivacy={togglePrivacy} onShare={() => setQr(true)} stats={myStats} recentGames={games.slice(0, 4)} onLogGame={() => setLogSheet({ pod: null })} quests={MM.QUESTS} friendStreaks={MM.FRIEND_STREAKS} onOpenPlayer={(p) => push({ type: 'preview', player: p })} onManageSocials={() => setSocialSheet(true)} onCopySocial={(s) => flash('Copied ' + (window.SOCIAL_META[s.platform] ? window.SOCIAL_META[s.platform].label : s.platform))} onPlayOnline={() => setPlayOnlineOpen(true)} />}
      </div>

      {/* ── Pushed stack screen ── */}
      {top && (
        <div key={stack.length} style={{
          position: 'absolute', inset: 0, top: 0, background: 'var(--bg)', zIndex: 30,
          display: 'flex', flexDirection: 'column',
          transform: leaving ? 'translateX(100%)' : 'translateX(0)',
          transition: leaving ? 'transform .26s cubic-bezier(.4,0,.7,.2)' : 'none',
          boxShadow: '-12px 0 40px rgba(0,0,0,0.10)',
        }}>
          {top.type !== 'stores' && top.type !== 'history' && top.type !== 'lifetracker' && <Header backable title={stackTitles[top.type]} big={false} onBack={pop} />}
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
            {top.type === 'preview' && <PreviewScreen p={top.player} variant={variant} sent={sentSet.has(top.player.id)} onSend={sendRequest} />}
            {top.type === 'connected' && <ConnectedScreen p={top.player} onViewProfile={() => setStack(s => [...s.slice(0, -1), { type: 'connDetail', player: top.player, meta: { metAt: 'Dragon’s Den', when: 'Just now' } }])} onDone={() => { clearStack(); setTab('connect'); }} />}
            {top.type === 'connDetail' && <ConnectionDetailScreen p={top.player} variant={variant} meta={top.meta} />}
            {top.type === 'pod' && <PodScreen pod={top.pod} isHost={top.isHost} me={me} onToast={flash} onClose={pop} onLogResult={() => setLogSheet({ pod: top.pod })} onLifeTracker={() => push({ type: 'lifetracker' })} />}
            {top.type === 'stores' && <StoresScreen onClose={pop} initialStoreId={top.storeId || null} />}
            {top.type === 'history' && <HistoryScreen onClose={pop} onDiscover={() => { clearStack(); setTab('discover'); }} onOpenPlayer={(p) => { pop(); setTimeout(() => push({ type: 'preview', player: MM.byId(p.id) || p }), 80); }} />}
            {top.type === 'lifetracker' && <LifeTrackerScreen onClose={pop} />}
          </div>
        </div>
      )}

      {/* ── Tab bar (root only) ── */}
      {stack.length === 0 && (
        <TabBar tab={tab} onTab={(x) => { clearStack(); setTab(x); }} onScan={() => setQr(true)} reqCount={reqCount} />
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{ position: 'absolute', bottom: 108, left: '50%', transform: 'translateX(-50%)', zIndex: 80,
          background: 'var(--ink)', color: 'var(--bg)', fontWeight: 700, fontSize: 13.5, padding: '11px 18px',
          borderRadius: 999, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}

      {/* ── LFG sheets (composer) ── */}
      {lfgSheet && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 95 }}>
          <div onClick={() => setLfgSheet(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(20,14,10,0.4)' }} />
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: 'var(--bg)', borderRadius: '28px 28px 0 0',
            paddingBottom: 30, maxHeight: '92%', overflow: 'auto', boxShadow: '0 -8px 40px rgba(0,0,0,0.2)' }}>
            <LFGComposer initial={lfgSheet === 'edit' ? lfgSession : null} onPublish={publishLfg} onClose={() => setLfgSheet(null)} />
          </div>
        </div>
      )}

      {/* ── Pod create sheet ── */}
      {podCreate && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 95 }}>
          <div onClick={() => setPodCreate(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(20,14,10,0.4)' }} />
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: 'var(--bg)', borderRadius: '28px 28px 0 0',
            paddingBottom: 30, maxHeight: '92%', overflow: 'auto', boxShadow: '0 -8px 40px rgba(0,0,0,0.2)' }}>
            <PodCreateSheet me={me} onCreate={createPod} onClose={() => setPodCreate(false)} />
          </div>
        </div>
      )}

      {/* ── Log a game sheet ── */}
      {logSheet && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 96 }}>
          <div onClick={() => setLogSheet(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(20,14,10,0.4)' }} />
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: 'var(--bg)', borderRadius: '28px 28px 0 0',
            paddingBottom: 30, maxHeight: '94%', overflow: 'auto', boxShadow: '0 -8px 40px rgba(0,0,0,0.2)' }}>
            <LogGameFlow pod={logSheet.pod} me={me} connections={connections} onSubmit={submitGame} onClose={() => setLogSheet(null)} />
          </div>
        </div>
      )}

      {/* ── Socials manage sheet ── */}
      {socialSheet && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 97 }}>
          <div onClick={() => setSocialSheet(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(20,14,10,0.4)' }} />
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: 'var(--bg)', borderRadius: '28px 28px 0 0',
            paddingBottom: 30, maxHeight: '94%', overflow: 'auto', boxShadow: '0 -8px 40px rgba(0,0,0,0.2)' }}>
            <window.SocialsManageSheet socials={meSocials} onChange={setMeSocials} onClose={() => setSocialSheet(false)} />
          </div>
        </div>
      )}

      {/* ── Play Online sheet ── */}
      {playOnlineOpen && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 98 }}>
          <div onClick={() => setPlayOnlineOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(20,14,10,0.4)' }} />
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: 'var(--bg)', borderRadius: '28px 28px 0 0',
            maxHeight: '92%', overflow: 'auto', boxShadow: '0 -8px 40px rgba(0,0,0,0.2)' }}>
            <PlayOnlineSheet connections={connections} onClose={() => setPlayOnlineOpen(false)} />
          </div>
        </div>
      )}

      {/* ── QR sheet ── */}
      {qr && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 90 }}>
          <div onClick={() => setQr(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(20,14,10,0.4)' }} />
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: 'var(--bg)', borderRadius: '28px 28px 0 0',
            paddingBottom: 38, maxHeight: '88%', overflow: 'auto', boxShadow: '0 -8px 40px rgba(0,0,0,0.2)' }}>
            <QRSheet me={me} onClose={() => setQr(false)} onScan={simulateScan} />
          </div>
        </div>
      )}

      {/* ── Notifications inbox (full overlay) ── */}
      {inbox && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 110, background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
          <Header backable title="Notifications" big={false} onBack={() => setInbox(false)} />
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <NotificationsInbox notifs={notifs} me={me} onTap={tapNotif} onClear={markAllRead} />
          </div>
        </div>
      )}

      {/* ── Walkthrough (first-login tour, after onboarding) ── */}
      {walkthrough && (
        <WalkthroughOverlay onDone={() => setWalkthrough(false)} />
      )}

      {/* ── Onboarding (first-run overlay within the device) ── */}
      {view === 'onboarding' && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 120, background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
          <OnboardingFlow
            me={me}
            onFinish={(draft) => { if (draft && draft.colors && draft.colors.length) setMeColors(draft.colors); setTweak('startView', 'app'); setView('app'); setTab('home'); if (scrollRef.current) scrollRef.current.scrollTop = 0; setTimeout(() => setWalkthrough(true), 420); }}
            onSkip={() => { setTweak('startView', 'app'); setView('app'); }}
          />
        </div>
      )}
    </div>
  );

  return (
    <>
      <div style={{ minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--stage-bg, #1b1814)' }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}>
          <IOSDevice dark={t.theme === 'dusk'}>
            {appBody}
          </IOSDevice>
        </div>
      </div>

      {/* ── Tweaks ── */}
      <TweaksPanel>
        <TweakSection label="Flow" />
        <TweakRadio label="Start on" value={t.startView} options={[
          { value: 'onboarding', label: 'Onboarding' }, { value: 'app', label: 'App' },
        ]} onChange={v => setTweak('startView', v)} />
        <TweakSection label="Player card" />
        <TweakRadio label="Card style" value={t.cardStyle} options={[
          { value: 'profile', label: 'Profile' }, { value: 'trading', label: 'Trading' }, { value: 'badge', label: 'Badge' },
        ]} onChange={v => setTweak('cardStyle', v)} />
        <TweakSection label="Visual style" />
        <TweakRadio label="Theme" value={t.theme} options={[
          { value: 'soft', label: 'Soft' }, { value: 'pop', label: 'Pop' }, { value: 'dusk', label: 'Dusk' },
        ]} onChange={v => setTweak('theme', v)} />
        <TweakColor label="Accent" value={t.brand} options={['#5AA452', '#3E83E6', '#E8743B', '#C0479B', '#8A6BE0']} onChange={v => setTweak('brand', v)} />
        <TweakSection label="Identity" />
        <TweakRadio label="App accent" value={t.accentMode} options={[
          { value: 'identity', label: 'Your colors' }, { value: 'manual', label: 'Manual' },
        ]} onChange={v => setTweak('accentMode', v)} />
        <TweakSection label="Type" />
        <TweakSelect label="Font" value={t.font} options={['Plus Jakarta Sans', 'Nunito', 'Figtree', 'DM Sans']} onChange={v => setTweak('font', v)} />
      </TweaksPanel>
    </>
  );
}

// ── Header ──
function Header({ backable, title, big, onBack, notifUnread, onBell }) {
  return (
    <div style={{ paddingTop: 54, position: 'relative', zIndex: 6, flexShrink: 0,
      background: big ? 'var(--bg)' : 'var(--header-bg)',
      backdropFilter: big ? 'none' : 'saturate(160%) blur(8px)',
      borderBottom: big ? 'none' : '1px solid var(--line)' }}>
      {backable ? (
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px 12px', minHeight: 40 }}>
          <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 2, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--brand)', fontFamily: 'inherit', fontWeight: 700, fontSize: 16, padding: 8 }}>
            <Icon name="chevL" size={22} stroke={2.6} /> Back
          </button>
          <div style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 17, fontWeight: 800, color: 'var(--ink)', pointerEvents: 'none' }}>{title}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 18px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
            <span style={{ fontSize: 32, fontWeight: 850, letterSpacing: '-0.03em', color: 'var(--ink)' }}>{title}</span>
          </div>
          <button onClick={onBell} style={{ position: 'relative', border: 'none', background: 'var(--chip-bg)', cursor: 'pointer', width: 42, height: 42, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitTapHighlightColor: 'transparent' }}>
            <Icon name="bell" size={22} color="var(--ink-2)" stroke={2.2} />
            {notifUnread > 0 && (
              <span style={{ position: 'absolute', top: 4, right: 4, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: '#E8484A', color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg)' }}>{notifUnread}</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function Wordmark() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: 0.85 }}>
      <span style={{ display: 'inline-flex', gap: 3 }}>
        {['U', 'R'].map(c => {
          const m = MM.MANA[c];
          return <span key={c} style={{ width: 14, height: 14, borderRadius: '50%', background: m.fill, boxShadow: `inset 0 0 0 1.5px ${m.ring}` }} />;
        })}
      </span>
      <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--muted)', letterSpacing: '-0.02em' }}>manamap</span>
    </div>
  );
}

// ── Tab bar ──
function TabBar({ tab, onTab, onScan, reqCount, hidden }) {
  const items = [
    { key: 'home',    icon: 'home',   label: 'Home' },
    { key: 'discover',icon: 'radar',  label: 'Nearby' },
    { key: 'scan',    icon: 'qr',     label: 'Scan', action: true },
    { key: 'connect', icon: 'users',  label: 'Connect', badge: reqCount },
    { key: 'you',     icon: 'user',   label: 'You' },
  ];
  return (
    <div style={{ flexShrink: 0, position: 'relative', zIndex: 40, background: 'var(--tabbar-bg)',
      backdropFilter: 'saturate(180%) blur(14px)', borderTop: '1px solid var(--line)',
      paddingBottom: 28, paddingTop: 9, display: 'flex', justifyContent: 'space-around', alignItems: 'flex-start' }}>
      {items.map(it => {
        const active = it.key === tab;
        if (it.action) {
          return (
            <button key={it.key} onClick={onScan} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontFamily: 'inherit', padding: 0, width: 64 }}>
              <span style={{ width: 46, height: 46, borderRadius: 16, background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 16px var(--brand-shadow)', marginTop: -2 }}>
                <Icon name="qr" size={24} color="var(--on-brand)" stroke={2.4} />
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>{it.label}</span>
            </button>
          );
        }
        return (
          <button key={it.key} onClick={() => onTab(it.key)} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontFamily: 'inherit', padding: 0, width: 64, position: 'relative' }}>
            <span style={{ position: 'relative' }}>
              <Icon name={it.icon} size={25} color={active ? 'var(--brand)' : 'var(--tab-idle)'} stroke={active ? 2.4 : 2} />
              {it.badge ? <span style={{ position: 'absolute', top: -4, right: -8, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999, background: '#E8484A', color: '#fff', fontSize: 10.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{it.badge}</span> : null}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: active ? 'var(--brand)' : 'var(--muted)' }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
