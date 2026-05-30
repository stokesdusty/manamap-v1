// manamap — shared components. Depends on window.MM. Exports to window.
const { MANA, COMBO_NAMES } = window.MM;

// ── helpers ───────────────────────────────────────────────
function comboName(colors) {
  if (!colors || !colors.length) return 'Colorless';
  const key = colors.join(',');
  return COMBO_NAMES[key] || colors.map(c => MANA[c].name).join('/');
}
function manaGradient(colors, angle = 135) {
  if (!colors || !colors.length) return '#9a93a3';
  if (colors.length === 1) {
    const f = MANA[colors[0]].fill;
    return `linear-gradient(${angle}deg, ${f}, ${shade(f, -18)})`;
  }
  const stops = colors.map(c => MANA[c].fill);
  return `linear-gradient(${angle}deg, ${stops.join(', ')})`;
}
function shade(hex, pct) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = pct / 100;
  r = Math.round(r + (f < 0 ? r : 255 - r) * f);
  g = Math.round(g + (f < 0 ? g : 255 - g) * f);
  b = Math.round(b + (f < 0 ? b : 255 - b) * f);
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}

// ── ManaPip ───────────────────────────────────────────────
function ManaPip({ c, size = 22, ring = true }) {
  const m = MANA[c];
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%',
      background: `radial-gradient(circle at 32% 28%, ${shade(m.fill, 22)}, ${m.fill} 60%, ${shade(m.fill, -14)})`,
      boxShadow: ring ? `inset 0 0 0 1.5px ${m.ring}, 0 1px 2px rgba(40,30,20,0.18)` : 'none',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      color: m.letter, fontWeight: 800, fontSize: size * 0.5,
      lineHeight: 1, flexShrink: 0, letterSpacing: '-0.02em',
    }}>{c}</span>
  );
}
function ManaRow({ colors, size = 22, gap = 4 }) {
  return (
    <span style={{ display: 'inline-flex', gap, alignItems: 'center' }}>
      {colors.map(c => <ManaPip key={c} c={c} size={size} />)}
    </span>
  );
}

// ── Avatar ────────────────────────────────────────────────
function Avatar({ player, size = 56, ring = 3 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '32%',
      background: manaGradient(player.colors),
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 800, fontSize: size * 0.42,
      boxShadow: `inset 0 1px 1px rgba(255,255,255,0.35), 0 2px 8px rgba(60,40,30,0.16)`,
      border: ring ? `${ring}px solid var(--surface)` : 'none',
      flexShrink: 0, position: 'relative', overflow: 'hidden',
      textShadow: '0 1px 2px rgba(0,0,0,0.18)',
    }}>
      <span style={{ position: 'relative', zIndex: 1 }}>{player.initials}</span>
    </div>
  );
}

// ── Chip ──────────────────────────────────────────────────
function Chip({ children, tone = 'neutral', size = 'md' }) {
  const pad = size === 'sm' ? '3px 9px' : '5px 11px';
  const fs = size === 'sm' ? 11.5 : 12.5;
  const tones = {
    neutral: { bg: 'var(--chip-bg)', fg: 'var(--chip-fg)' },
    brand: { bg: 'var(--brand-soft)', fg: 'var(--brand-ink)' },
  };
  const tn = tones[tone] || tones.neutral;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: pad, borderRadius: 999, fontSize: fs, fontWeight: 650,
      background: tn.bg, color: tn.fg, whiteSpace: 'nowrap',
      letterSpacing: '-0.01em',
    }}>{children}</span>
  );
}

// ── MetBadge ──────────────────────────────────────────────
function MetBadge({ where }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700,
      background: 'var(--brand-soft)', color: 'var(--brand-ink)',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--brand)' }} />
      Met at {where}
    </span>
  );
}

Object.assign(window, { comboName, manaGradient, shade, ManaPip, ManaRow, Avatar, Chip, MetBadge });
