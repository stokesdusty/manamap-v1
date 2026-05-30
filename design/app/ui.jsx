// manamap — UI primitives. Depends on Icon. Exports to window.
const { Icon: _Icon } = window;

function Button({ children, onClick, variant = 'primary', full, icon, size = 'md', disabled }) {
  const sizes = { md: { pad: '14px 18px', fs: 16 }, sm: { pad: '10px 14px', fs: 14 } };
  const s = sizes[size];
  const variants = {
    primary: { background: 'var(--brand)', color: 'var(--on-brand)', boxShadow: '0 4px 14px var(--brand-shadow)' },
    soft: { background: 'var(--brand-soft)', color: 'var(--brand-ink)' },
    ghost: { background: 'var(--chip-bg)', color: 'var(--ink)' },
    danger: { background: 'var(--surface)', color: '#C0492F', border: '1.5px solid var(--line)' },
    outline: { background: 'var(--surface)', color: 'var(--ink)', border: '1.5px solid var(--line)' },
  };
  return (
    <button onClick={disabled ? undefined : onClick} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      padding: s.pad, fontSize: s.fs, fontWeight: 750, borderRadius: 'var(--r-btn)',
      border: 'none', cursor: disabled ? 'default' : 'pointer', width: full ? '100%' : undefined,
      fontFamily: 'inherit', letterSpacing: '-0.01em', opacity: disabled ? 0.5 : 1,
      transition: 'transform .12s ease, filter .15s ease', WebkitTapHighlightColor: 'transparent',
      ...variants[variant],
    }}
      onMouseDown={e => { if (!disabled) e.currentTarget.style.transform = 'scale(0.97)'; }}
      onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
      {icon && <_Icon name={icon} size={s.fs + 3} stroke={2.4} />}
      {children}
    </button>
  );
}

function Segmented({ value, options, onChange }) {
  return (
    <div style={{ display: 'flex', background: 'var(--chip-bg)', borderRadius: 999, padding: 4, gap: 4 }}>
      {options.map(o => {
        const active = o.value === value;
        return (
          <button key={o.value} onClick={() => onChange(o.value)} style={{
            flex: 1, padding: '9px 10px', borderRadius: 999, border: 'none', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em',
            background: active ? 'var(--surface)' : 'transparent',
            color: active ? 'var(--ink)' : 'var(--muted)',
            boxShadow: active ? '0 1px 4px rgba(40,30,20,0.12)' : 'none',
            transition: 'all .18s ease', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            {o.icon && <_Icon name={o.icon} size={16} stroke={2.4} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Switch({ on, onToggle }) {
  return (
    <button onClick={onToggle} style={{
      width: 50, height: 30, borderRadius: 999, border: 'none', cursor: 'pointer', padding: 0,
      background: on ? 'var(--brand)' : 'var(--switch-off)', position: 'relative',
      transition: 'background .2s ease', flexShrink: 0,
    }}>
      <span style={{
        position: 'absolute', top: 3, left: on ? 23 : 3, width: 24, height: 24, borderRadius: 999,
        background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transition: 'left .2s cubic-bezier(.4,1.3,.5,1)',
      }} />
    </button>
  );
}

function SectionLabel({ children, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px 9px' }}>
      <span style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--muted)' }}>{children}</span>
      {action}
    </div>
  );
}

function LockedPanel({ children }) {
  return (
    <div style={{ position: 'relative', borderRadius: 'var(--r-lg)', overflow: 'hidden', border: '1px solid var(--line)' }}>
      <div style={{ filter: 'blur(5px)', opacity: 0.5, pointerEvents: 'none', padding: 18, background: 'var(--surface)' }}>{children}</div>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--lock-veil)' }}>
        <div style={{ width: 38, height: 38, borderRadius: 999, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(40,30,20,0.14)' }}>
          <_Icon name="shield" size={20} color="var(--muted)" />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)' }}>Connect to unlock contact</span>
      </div>
    </div>
  );
}

Object.assign(window, { Button, Segmented, Switch, SectionLabel, LockedPanel });
