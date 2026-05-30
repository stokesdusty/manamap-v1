// manamap — PlayerCard variants. Depends on components. Exports PlayerCard to window.
const { ManaRow, Avatar, Chip, comboName, manaGradient, shade } = window;
const _MANA = window.MM.MANA;

// ── Variant: Profile (clean, friendly) ───────────────────
function CardProfile({ p, preview }) {
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 'var(--r-lg)',
      padding: 20, boxShadow: 'var(--shadow-card)', border: '1px solid var(--line)',
    }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <Avatar player={p} size={64} />
        <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.02em' }}>{p.name}</span>
            <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>{p.pronouns}</span>
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--muted)', fontWeight: 600, marginTop: 1 }}>{p.handle}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <ManaRow colors={p.colors} size={22} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{comboName(p.colors)}</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16, fontSize: 14.5, lineHeight: 1.5, color: 'var(--ink-2)' }}>{p.bio}</div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 14 }}>
        {p.formats.map(f => <Chip key={f}>{f}</Chip>)}
        <Chip tone="brand">{p.vibe}</Chip>
      </div>

      <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Stat label="Commander" value={p.commander} />
        <Stat label="Power level" value={`${p.power} / 10`} />
      </div>
    </div>
  );
}
function Stat({ label, value }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--muted)' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
    </div>
  );
}

// ── Variant: Trading (playful card riff) ─────────────────
function CardTrading({ p, preview }) {
  const c0 = _MANA[p.colors[0]].fill;
  const c1 = _MANA[p.colors[p.colors.length - 1]].fill;
  const frame = `linear-gradient(150deg, ${shade(c0, 4)}, ${shade(c1, -6)})`;
  return (
    <div style={{
      borderRadius: 'var(--r-lg)', padding: 9, background: frame,
      boxShadow: 'var(--shadow-card)',
    }}>
      <div style={{ borderRadius: 'calc(var(--r-lg) - 6px)', background: 'var(--surface)', overflow: 'hidden', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.5)' }}>
        {/* title bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '11px 13px 9px' }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.02em' }}>{p.name}</span>
          <ManaRow colors={p.colors} size={20} />
        </div>
        {/* art box */}
        <div style={{
          margin: '0 9px', height: 150, borderRadius: 10, position: 'relative', overflow: 'hidden',
          background: manaGradient(p.colors, 145),
          boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06), inset 0 2px 12px rgba(255,255,255,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ position: 'absolute', inset: 0, opacity: 0.5,
            backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.16) 0 2px, transparent 2px 9px)' }} />
          <span style={{ fontSize: 84, fontWeight: 900, color: 'rgba(255,255,255,0.9)', textShadow: '0 3px 14px rgba(0,0,0,0.22)', position: 'relative' }}>{p.initials}</span>
          <span style={{ position: 'absolute', bottom: 8, left: 11, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.02em' }}>{p.handle}</span>
        </div>
        {/* type line */}
        <div style={{ margin: '10px 9px 0', padding: '7px 12px', borderRadius: 8, background: 'var(--chip-bg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--ink)' }}>Player — {comboName(p.colors)}</span>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)' }}>{p.vibe}</span>
        </div>
        {/* text box */}
        <div style={{ padding: '11px 14px 4px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)' }}>Plays <span style={{ color: 'var(--ink)' }}>{p.commander}</span></div>
          <div style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--ink-2)', marginTop: 7, fontStyle: 'italic' }}>{p.bio}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 11 }}>
            {p.formats.map(f => <Chip key={f} size="sm">{f}</Chip>)}
          </div>
        </div>
        {/* bottom bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px 13px' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>manamap</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)', background: 'var(--chip-bg)', borderRadius: 7, padding: '4px 10px' }}>PWR {p.power}</span>
        </div>
      </div>
    </div>
  );
}

// ── Variant: Badge (compact horizontal) ──────────────────
function CardBadge({ p }) {
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 'var(--r-lg)', padding: 14,
      boxShadow: 'var(--shadow-card)', border: '1px solid var(--line)',
      display: 'flex', gap: 14, alignItems: 'center',
    }}>
      <Avatar player={p} size={62} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.02em' }}>{p.name}</span>
          <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{p.handle}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 7 }}>
          <ManaRow colors={p.colors} size={18} />
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)' }}>{comboName(p.colors)}</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 9 }}>
          {p.formats.slice(0, 2).map(f => <Chip key={f} size="sm">{f}</Chip>)}
          <Chip size="sm" tone="brand">PWR {p.power}</Chip>
        </div>
      </div>
    </div>
  );
}

function PlayerCard({ p, variant = 'profile', preview }) {
  if (variant === 'trading') return <CardTrading p={p} preview={preview} />;
  if (variant === 'badge') return <CardBadge p={p} />;
  return <CardProfile p={p} preview={preview} />;
}

Object.assign(window, { PlayerCard, Stat });
