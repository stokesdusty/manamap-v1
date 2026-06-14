// manamap — Preview / Connected reveal / Contact. Depends on cards, ui, icons.
const { Icon, PlayerCard, Button, LockedPanel, SectionLabel, Avatar, ManaRow, comboName, manaGradient } = window;
const _RR = React;

function ContactPanel({ p }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <ContactRow icon="discord" label="Discord" value={p.discord} action="Copy" />
      {p.decks.map((d, i) => (
        <ContactRow key={i} icon="cards" label={d.site} value={d.name} sub={d.url} action="Open" />
      ))}
    </div>
  );
}
function ContactRow({ icon, label, value, sub, action }) {
  const [done, setDone] = _RR.useState(false);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '12px 14px', boxShadow: 'var(--shadow-row)' }}>
      <div style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--brand-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name={icon} size={20} color="var(--brand-ink)" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.03em', textTransform: 'uppercase', color: 'var(--muted)' }}>{label}</div>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ink)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
      </div>
      <button onClick={() => { setDone(true); setTimeout(() => setDone(false), 1400); }} style={{
        border: 'none', background: 'var(--chip-bg)', color: 'var(--ink)', fontFamily: 'inherit',
        fontWeight: 750, fontSize: 13, padding: '8px 13px', borderRadius: 999, cursor: 'pointer', flexShrink: 0,
      }}>{done ? '✓' : action}</button>
    </div>
  );
}

// View a player you haven't connected with yet
function PreviewScreen({ p, variant, sent, onSend }) {
  return (
    <div style={{ padding: '4px 16px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {p.metBefore && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'var(--brand-soft)', borderRadius: 'var(--r-md)', padding: '11px 14px' }}>
          <Icon name="sparkle" size={18} color="var(--brand-ink)" />
          <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--brand-ink)' }}>You met at {p.metAt} before</span>
        </div>
      )}

      <PlayerCard p={p} variant={variant} preview />

      <div>
        <SectionLabel>Contact &amp; decks</SectionLabel>
        <LockedPanel>
          <ContactPanel p={p} />
        </LockedPanel>
      </div>

      {p.socials && p.socials.length > 0 && (
        <window.SocialsCard socials={p.socials} mode="public" />
      )}

      <div style={{ position: 'sticky', bottom: 0 }}>
        {sent ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, background: 'var(--surface)', border: '1.5px solid var(--line)', borderRadius: 'var(--r-btn)', padding: 14, color: 'var(--ink-2)', fontWeight: 750, fontSize: 15 }}>
            <Icon name="check" size={18} color="var(--brand)" /> Request sent — waiting for {p.name}
          </div>
        ) : (
          <Button variant="primary" full icon="plus" onClick={() => onSend(p)}>Send connect request</Button>
        )}
        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)', fontWeight: 600, marginTop: 9 }}>
          They approve before any contact info is shared.
        </div>
      </div>
    </div>
  );
}

// Celebratory unlock
function ConnectedScreen({ p, onViewProfile, onDone }) {
  return (
    <div style={{ padding: '4px 16px 28px' }}>
      <div style={{ position: 'relative', borderRadius: 'var(--r-lg)', overflow: 'hidden', padding: '32px 20px 26px', textAlign: 'center',
        background: manaGradient(p.colors, 150), color: '#fff', boxShadow: 'var(--shadow-card)' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.4, backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.14) 0 2px, transparent 2px 11px)' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: -6, marginBottom: 16 }}>
            <div style={{ width: 64, height: 64, borderRadius: '34%', background: manaGradient(window.MM.ME.colors), border: '3px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 26, marginRight: -14, zIndex: 2, textShadow: '0 1px 2px rgba(0,0,0,.2)' }}>{window.MM.ME.initials}</div>
            <div style={{ width: 64, height: 64, borderRadius: '34%', background: manaGradient(p.colors), border: '3px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 26, textShadow: '0 1px 2px rgba(0,0,0,.2)' }}>{p.initials}</div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.9 }}>Connected</div>
          <div style={{ fontSize: 26, fontWeight: 850, letterSpacing: '-0.02em', marginTop: 4, textShadow: '0 2px 8px rgba(0,0,0,0.18)' }}>You &amp; {p.name}</div>
          <div style={{ fontSize: 14, fontWeight: 650, opacity: 0.92, marginTop: 6 }}>Cards swapped at Dragon’s Den</div>
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <SectionLabel>Now unlocked</SectionLabel>
        <ContactPanel p={p} />
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <Button variant="ghost" full onClick={onViewProfile}>View full card</Button>
        <Button variant="primary" full onClick={onDone}>Done</Button>
      </div>
    </div>
  );
}

// Full connection detail (already connected)
function ConnectionDetailScreen({ p, variant, meta }) {
  return (
    <div style={{ padding: '4px 16px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {meta && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'var(--brand-soft)', borderRadius: 'var(--r-md)', padding: '11px 14px' }}>
          <Icon name="pin" size={18} color="var(--brand-ink)" />
          <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--brand-ink)' }}>Met at {meta.metAt} · {meta.when}</span>
        </div>
      )}
      <PlayerCard p={p} variant={variant} />
      <div>
        <SectionLabel>Contact &amp; decks</SectionLabel>
        <ContactPanel p={p} />
      </div>

      {p.socials && p.socials.length > 0 && (
        <window.SocialsCard socials={p.socials} mode="friend" />
      )}
    </div>
  );
}

Object.assign(window, { PreviewScreen, ConnectedScreen, ConnectionDetailScreen, ContactPanel });
