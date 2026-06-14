// manamap — Home screen (hub / dashboard). Exports HomeScreen.
// Depends on: Icon, gameStats (window globals), MM data.
const { Icon: _HI } = window;
const _MMH = window.MM;
const { useState: _Hus } = React;

const EVT_COLOR = { STORE: 'var(--brand)', DISCORD: '#5865F2', WIZARDS: '#9333ea' };

function greet() {
  const h = new Date().getHours();
  return h < 12 ? 'Morning' : h < 17 ? 'Hey' : 'Evening';
}
function fmtMins(m) {
  if (!m) return '—';
  const h = Math.floor(m / 60), r = m % 60;
  if (h > 0) return r ? `${h}h ${r}m` : `${h}h`;
  return `${m}m`;
}

// ── Section label ─────────────────────────────────────────
function HL({ children, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '0 2px', marginBottom: 9, gap: 8 }}>
      <span style={{ flex: 1, minWidth: 0, display: 'block', fontSize: 12, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{children}</span>
      {action && <span style={{ flexShrink: 0 }}>{action}</span>}
    </div>
  );
}

// ── Identity banner (full-bleed, safe-area aware) ─────────
function IdentityBanner({ me, lfg, todayEvents, onBell, notifUnread, onOpenStores }) {
  const nextEvent = todayEvents.find(e => e.attending) || todayEvents[0];
  return (
    <div style={{
      backgroundImage: 'var(--identity-grad)',
      paddingTop: 60, paddingBottom: 22, paddingLeft: 18, paddingRight: 18,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* diagonal texture */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.14,
        backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.3) 0 1.5px, transparent 1.5px 14px)' }} />

      {/* bell */}
      <button onClick={onBell} style={{
        position: 'absolute', top: 58, right: 16, zIndex: 2, width: 40, height: 40,
        borderRadius: 999, border: 'none', cursor: 'pointer',
        background: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', backdropFilter: 'blur(6px)',
        WebkitTapHighlightColor: 'transparent',
      }}>
        <_HI name="bell" size={20} color="#fff" stroke={2.2} />
        {notifUnread > 0 && (
          <span style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8,
            borderRadius: 999, background: '#E8484A', border: '1.5px solid rgba(255,255,255,0.5)' }} />
        )}
      </button>

      <div style={{ position: 'relative' }}>
        <div style={{ fontSize: 13.5, fontWeight: 650, color: 'rgba(255,255,255,0.72)', letterSpacing: '-0.01em' }}>
          {greet()},
        </div>
        <div style={{
          fontSize: 34, fontWeight: 850, color: '#fff', letterSpacing: '-0.035em',
          lineHeight: 1.06, textShadow: '0 2px 14px rgba(0,0,0,0.18)', marginTop: 1,
        }}>
          {me.name}
        </div>

        {/* store / check-in — tappable, opens Stores */}
        <button onClick={() => onOpenStores && onOpenStores('s1')} style={{
          display: 'flex', alignItems: 'center', gap: 7, marginTop: 13,
          background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit',
          WebkitTapHighlightColor: 'transparent',
        }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: '#4ade80', flexShrink: 0,
            boxShadow: '0 0 8px rgba(74,222,128,0.85)' }} />
          <span style={{ fontSize: 14.5, fontWeight: 750, color: '#fff', letterSpacing: '-0.015em' }}>{me.homeStore}</span>
          <span style={{
            fontSize: 11.5, fontWeight: 700, color: 'rgba(255,255,255,0.85)',
            background: 'rgba(255,255,255,0.18)', padding: '2px 9px', borderRadius: 999,
            backdropFilter: 'blur(4px)',
          }}>Checked in ›</span>
        </button>

        {/* status pills */}
        <div style={{ display: 'flex', gap: 7, marginTop: 12, flexWrap: 'wrap' }}>
          {lfg.open && (
            <BannerPill>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: '#4ade80',
                boxShadow: '0 0 5px rgba(74,222,128,0.9)', flexShrink: 0 }} />
              Open · {fmtMins(lfg.session?.mins)} left
            </BannerPill>
          )}
          <BannerPill>🔥 2w streak</BannerPill>
          {nextEvent && (
            <BannerPill>
              📅 {nextEvent.name}{nextEvent.attending ? ' · RSVP\u2019d' : ' tonight'}
            </BannerPill>
          )}
        </div>
      </div>
    </div>
  );
}

function BannerPill({ children }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 12, fontWeight: 750, color: '#fff',
      background: 'rgba(255,255,255,0.18)', padding: '4px 11px',
      borderRadius: 999, backdropFilter: 'blur(4px)',
    }}>{children}</span>
  );
}

// ── Quick action tiles (2 × 2) ────────────────────────────
function QuickActions({ lfg, requests, nearbyCount, onTab, onLogGame, onGoOpen }) {
  const tiles = [
    {
      icon: 'sparkle',
      label: 'Open to Play',
      sub: lfg.open ? `${fmtMins(lfg.session?.mins)} left` : 'Tap to go live',
      live: lfg.open,
      onTap: lfg.open ? () => {} : onGoOpen,
    },
    {
      icon: 'cards',
      label: 'Log a Game',
      sub: 'Record a result',
      onTap: onLogGame,
    },
    {
      icon: 'radar',
      label: 'Meet Players',
      sub: `${nearbyCount} nearby now`,
      onTap: () => onTab('discover'),
    },
    {
      icon: 'users',
      label: 'Connections',
      sub: requests.length > 0
        ? `${requests.length} pending request${requests.length > 1 ? 's' : ''}`
        : 'Your network',
      badge: requests.length || null,
      onTap: () => onTab('connect'),
    },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '16px 16px 0' }}>
      {tiles.map((tile, i) => <ActionTile key={i} {...tile} />)}
    </div>
  );
}

function ActionTile({ icon, label, sub, live, badge, onTap }) {
  const [pressed, setPressed] = _Hus(false);
  return (
    <button
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onClick={onTap}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 11,
        background: 'var(--surface)', border: '1px solid var(--line)',
        borderRadius: 'var(--r-lg)', padding: '15px 14px 14px',
        cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        boxShadow: 'var(--shadow-card)', WebkitTapHighlightColor: 'transparent',
        position: 'relative', transition: 'transform .1s ease, box-shadow .1s ease',
        transform: pressed ? 'scale(0.96)' : 'scale(1)',
      }}>

      {/* badge */}
      {badge ? (
        <span style={{
          position: 'absolute', top: 11, right: 11, minWidth: 18, height: 18,
          borderRadius: 999, background: '#E8484A', color: '#fff', fontSize: 11,
          fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 4px', border: '2px solid var(--surface)',
        }}>{badge}</span>
      ) : null}

      {/* icon well */}
      <span style={{
        width: 44, height: 44, borderRadius: 14, flexShrink: 0, position: 'relative',
        background: 'color-mix(in srgb, var(--brand) 12%, var(--surface))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <_HI name={icon} size={22} color="color-mix(in srgb, var(--brand) 72%, var(--ink))" stroke={2.2} />
        {live && (
          <span style={{
            position: 'absolute', top: -2, right: -2, width: 11, height: 11,
            borderRadius: 999, background: '#4ade80', border: '2.5px solid var(--surface)',
          }} />
        )}
      </span>

      <div style={{ minWidth: 0, width: '100%' }}>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.01em', lineHeight: 1.2 }}>{label}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginTop: 3, lineHeight: 1.3 }}>{sub}</div>
      </div>
    </button>
  );
}

// ── Needs Attention ───────────────────────────────────────
function AttentionSection({ requests, pendingGames, onTab }) {
  const items = [
    pendingGames.length > 0 && {
      dot: 'var(--brand)',
      text: `${pendingGames.length} game result${pendingGames.length > 1 ? 's' : ''} to confirm`,
    },
    requests.length > 0 && {
      dot: '#4ade80',
      text: `${requests.length} new connection request${requests.length > 1 ? 's' : ''}`,
    },
  ].filter(Boolean);

  if (!items.length) return null;
  return (
    <div style={{ padding: '16px 16px 0' }}>
      <HL>Needs Attention</HL>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--line)',
        borderRadius: 'var(--r-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-card)',
      }}>
        {items.map((item, i) => (
          <button key={i} onClick={() => onTab('connect')} style={{
            display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
            padding: '14px 16px', border: 'none', fontFamily: 'inherit', cursor: 'pointer',
            background: 'none', borderTop: i > 0 ? '1px solid var(--line)' : 'none',
            WebkitTapHighlightColor: 'transparent',
          }}>
            <span style={{ width: 9, height: 9, borderRadius: 999, background: item.dot, flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{item.text}</span>
            <_HI name="chevR" size={16} color="var(--muted)" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Today at store ────────────────────────────────────────
function TodaySection({ events, store }) {
  return (
    <div style={{ padding: '16px 16px 0' }}>
      <HL action={
        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--brand-ink)', cursor: 'pointer' }}>See all →</span>
      }>Tonight · {store}</HL>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--line)',
        borderRadius: 'var(--r-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-card)',
      }}>
        {events.slice(0, 3).map((evt, i) => (
          <div key={evt.id} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px',
            borderTop: i > 0 ? '1px solid var(--line)' : 'none',
          }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, flexShrink: 0,
              background: EVT_COLOR[evt.source] ?? 'var(--brand)' }} />
            <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: 'var(--ink)', minWidth: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{evt.name}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', flexShrink: 0 }}>{evt.format}</span>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)', flexShrink: 0, minWidth: 58, textAlign: 'right' }}>{evt.time}</span>
            {evt.attending && (
              <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--brand-ink)', background: 'var(--brand-soft)',
                padding: '2px 8px', borderRadius: 999, flexShrink: 0 }}>RSVP'd</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Your month: stats + top quest ─────────────────────────
function ProgressSection({ stats, quests, onHistory }) {
  const topQuest = quests[0];
  const hasStats = stats.wins > 0 || stats.losses > 0;
  const isEmpty = !hasStats && !topQuest;

  return (
    <div style={{ padding: '16px 16px 0' }}>
      <HL action={
        <span onClick={onHistory} style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--brand-ink)', cursor: 'pointer' }}>History ›</span>
      }>Your Month</HL>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--line)',
        borderRadius: 'var(--r-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-card)',
      }}>
        {hasStats && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px',
            borderBottom: topQuest ? '1px solid var(--line)' : 'none',
          }}>
            <_HI name="trophy" size={16} color="var(--brand-ink)" />
            <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>
              {stats.wins}W · {stats.losses}L this month
            </span>
            {stats.winRate > 0 && (
              <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--brand-ink)',
                background: 'var(--brand-soft)', padding: '3px 10px', borderRadius: 999 }}>
                {stats.winRate}%
              </span>
            )}
          </div>
        )}
        {topQuest && (
          <div style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <_HI name="flame" size={15} color="oklch(0.73 0.16 65)" />
              <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{topQuest.title}</span>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--ink-2)' }}>
                {topQuest.progress}/{topQuest.goal}
              </span>
            </div>
            <div style={{ height: 7, borderRadius: 999, background: 'var(--chip-bg)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 999, background: 'var(--brand)',
                width: `${Math.round(100 * Math.min(topQuest.progress, topQuest.goal) / topQuest.goal)}%`,
              }} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginTop: 7 }}>
              Reward: {topQuest.reward}
            </div>
          </div>
        )}
        {isEmpty && (
          <div style={{ padding: '22px 16px', textAlign: 'center', fontSize: 13.5, fontWeight: 600, color: 'var(--muted)', lineHeight: 1.5 }}>
            Play games and complete quests to track your progress here
          </div>
        )}
      </div>
    </div>
  );
}

// ── HomeScreen ────────────────────────────────────────────
function HomeScreen({ me, connections, requests, pendingGames, games, quests, pods, lfg, notifUnread, onTab, onLogGame, onBell, onOpenStores, onOpenHistory }) {
  const stats = window.gameStats ? window.gameStats(games) : { wins: 0, losses: 0, winRate: 0 };
  const activeQuests = (quests ?? []).filter(q => !q.done);
  const todayEvents = _MMH.TODAY_EVENTS ?? [];
  const nearbyCount = _MMH.PLAYERS.length;

  return (
    <div style={{ paddingBottom: 28 }}>
      <IdentityBanner
        me={me} lfg={lfg} todayEvents={todayEvents}
        onBell={onBell} notifUnread={notifUnread} onOpenStores={onOpenStores}
      />
      <QuickActions
        lfg={lfg} requests={requests} nearbyCount={nearbyCount}
        onTab={onTab} onLogGame={onLogGame} onGoOpen={lfg.onGoOpen}
      />
      <AttentionSection requests={requests} pendingGames={pendingGames} onTab={onTab} />
      {todayEvents.length > 0 && (
        <TodaySection events={todayEvents} store={me.homeStore} />
      )}
      <ProgressSection stats={stats} quests={activeQuests} onHistory={onOpenHistory} />
    </div>
  );
}

Object.assign(window, { HomeScreen });
