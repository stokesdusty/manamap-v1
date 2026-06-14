// manamap — History / Encounters screen (M36). Exports HistoryScreen.
const { useState: _Hius } = React;
const { Icon: _HisI, manaGradient: _Hismg } = window;
const _HisMM = window.MM;

const SRC = {
  PRESENCE:   { label: 'Crossed paths',  color: 'var(--brand)',  icon: 'radar'  },
  CONNECTION: { label: 'Connected',      color: '#16a34a',       icon: 'users'  },
  GAME:       { label: 'Played a game',  color: '#9333ea',       icon: 'cards'  },
};

function relDate(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `${d}d ago`;
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function groupLabel(iso) {
  const now  = new Date();
  const date = new Date(iso);
  const todayStr = now.toISOString().slice(0, 10);
  const weekAgo  = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const dayStr   = date.toISOString().slice(0, 10);
  if (dayStr === todayStr)    return 'Today';
  if (dayStr >= weekAgo)      return 'This week';
  return 'Earlier';
}

// ── Encounter card ────────────────────────────────────────
function EncounterCard({ enc, onPress }) {
  const src = SRC[enc.source] || SRC.PRESENCE;
  const [pressed, setPressed] = _Hius(false);
  return (
    <button
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onClick={() => onPress && onPress(enc)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        width: '100%', textAlign: 'left', padding: '11px 16px',
        border: 'none', borderBottom: '1px solid var(--line)',
        background: pressed ? 'var(--chip-bg)' : 'var(--surface)',
        cursor: 'pointer', fontFamily: 'inherit',
        transition: 'background .1s ease',
        WebkitTapHighlightColor: 'transparent',
      }}>
      {/* Avatar */}
      <div style={{
        width: 44, height: 44, borderRadius: '30%', flexShrink: 0,
        background: _Hismg(enc.peer.colors),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, fontWeight: 800, color: '#fff',
        boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.3)',
      }}>{enc.peer.name[0]}</div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.01em',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {enc.peer.name}
        </div>
        {/* Source + store */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3, flexWrap: 'nowrap', minWidth: 0 }}>
          <_HisI name={src.icon} size={12} color={src.color} stroke={2.2} />
          <span style={{ fontSize: 12, fontWeight: 750, color: src.color, flexShrink: 0 }}>{src.label}</span>
          {enc.storeName && <>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>·</span>
            <_HisI name="storefront" size={11} color="var(--muted)" stroke={2} />
            <span style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {enc.storeName}
            </span>
          </>}
        </div>
        {/* Commander */}
        {enc.peer.commander && (
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, fontWeight: 600,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {enc.peer.commander}
          </div>
        )}
      </div>

      {/* Timestamp */}
      <div style={{ fontSize: 12, color: 'var(--muted)', flexShrink: 0, alignSelf: 'flex-start', paddingTop: 2 }}>
        {relDate(enc.createdAt)}
      </div>
    </button>
  );
}

// ── Section label ─────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 11.5, fontWeight: 800, letterSpacing: '0.055em', textTransform: 'uppercase',
      color: 'var(--muted)', padding: '14px 16px 6px', background: 'var(--bg)',
    }}>{children}</div>
  );
}

// ── Crossed-paths nudge ───────────────────────────────────
function CrossedPathsNudge({ count, onDiscover }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10, margin: '12px 16px',
      padding: 13, background: 'var(--brand-soft)',
      border: '1px solid color-mix(in srgb, var(--brand) 22%, transparent)',
      borderRadius: 'var(--r-md)',
    }}>
      <_HisI name="radar" size={18} color="var(--brand-ink)" stroke={2} />
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.5 }}>
          You&rsquo;ve crossed paths with{' '}
          <span style={{ color: 'var(--brand-ink)', fontWeight: 850 }}>{count}</span>
          {` player${count !== 1 ? 's' : ''} you haven\u2019t connected with yet`}
        </span>
        <button onClick={onDiscover} style={{
          display: 'block', marginTop: 6, border: 'none', background: 'none',
          cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 800,
          color: 'var(--brand-ink)', padding: 0,
        }}>See nearby players &rsaquo;</button>
      </div>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────
function EmptyHistory() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      flex: 1, padding: '40px 32px', gap: 12, textAlign: 'center' }}>
      <div style={{ width: 56, height: 56, borderRadius: 18, background: 'var(--chip-bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <_HisI name="clock" size={28} color="var(--muted)" stroke={1.8} />
      </div>
      <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.015em' }}>No history yet</div>
      <div style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 600, lineHeight: 1.55 }}>
        Players you meet at stores or connect with will appear here
      </div>
    </div>
  );
}

// ── HistoryScreen ─────────────────────────────────────────
function HistoryScreen({ onClose, onDiscover, onOpenPlayer }) {
  const encounters = _HisMM.ENCOUNTERS || [];
  const crossedPathsCount = _HisMM.CROSSED_PATHS_COUNT || 0;

  // Deduplicate — one entry per peer, most recent wins (data is pre-sorted)
  const seen = new Set();
  const unique = encounters.filter(e => { if (seen.has(e.peer.id)) return false; seen.add(e.peer.id); return true; });

  // Group by section
  const GROUP_ORDER = ['Today', 'This week', 'Earlier'];
  const grouped = {};
  unique.forEach(e => {
    const g = groupLabel(e.createdAt);
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(e);
  });
  const sections = GROUP_ORDER.filter(g => grouped[g]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', paddingTop: 54 }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 16px 10px', borderBottom: '1px solid var(--line)', flexShrink: 0,
      }}>
        <button onClick={onClose} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center',
          justifyContent: 'center', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--brand)' }}>
          <_HisI name="chevD" size={26} color="var(--muted)" stroke={2.2} />
        </button>
        <div style={{ fontSize: 19, fontWeight: 850, color: 'var(--ink)', letterSpacing: '-0.02em' }}>History</div>
        <div style={{ width: 36 }} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {crossedPathsCount > 0 && (
          <CrossedPathsNudge count={crossedPathsCount} onDiscover={onDiscover} />
        )}

        {unique.length === 0 ? (
          <EmptyHistory />
        ) : (
          sections.map(group => (
            <div key={group}>
              <SectionLabel>{group}</SectionLabel>
              {grouped[group].map(enc => (
                <EncounterCard key={enc.id} enc={enc}
                  onPress={() => onOpenPlayer && onOpenPlayer(enc.peer)} />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

Object.assign(window, { HistoryScreen });
