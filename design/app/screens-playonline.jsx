// manamap — Play Online sheet (M38). Exports PlayOnlineSheet.
const { useState: _POus } = React;
const { Icon: _POI, Avatar: _POAv } = window;
const _POMM = window.MM;

const PLATFORMS = [
  { key: 'spelltable', label: 'SpellTable', icon: 'globe',  ph: 'https://spelltable.wizards.com/room/...' },
  { key: 'convoke',    label: 'Convoke',    icon: 'swords', ph: 'Room name or invite link' },
];

function PlayOnlineSheet({ connections, onClose }) {
  const [platform, setPlatform] = _POus('spelltable');
  const [link, setLink] = _POus('');
  const [selected, setSelected] = _POus(new Set());
  const [sent, setSent] = _POus(false);

  const plat = PLATFORMS.find(p => p.key === platform);
  const canSend = link.trim().length > 0 && selected.size > 0;

  function toggle(id) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function handleSend() {
    if (!canSend) return;
    setSent(true);
    setTimeout(() => { setSent(false); setLink(''); setSelected(new Set()); onClose(); }, 2200);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '92%', position: 'relative' }}>
      {/* Handle + header */}
      <div style={{ flexShrink: 0, paddingTop: 10, paddingBottom: 14, paddingLeft: 18, paddingRight: 18, borderBottom: '1px solid var(--line)' }}>
        <div style={{ width: 36, height: 4, borderRadius: 999, background: 'var(--line-strong)', margin: '0 auto 14px' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 19, fontWeight: 850, color: 'var(--ink)', letterSpacing: '-0.02em' }}>Play Online</div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 999, background: 'var(--chip-bg)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <_POI name="x" size={16} color="var(--muted)" />
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 18px 128px' }}>

        {/* Platform */}
        <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', marginBottom: 8 }}>Platform</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {PLATFORMS.map(p => {
            const on = platform === p.key;
            return (
              <button key={p.key} onClick={() => setPlatform(p.key)} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                height: 46, border: `1.5px solid ${on ? 'var(--brand)' : 'var(--line)'}`,
                background: on ? 'var(--brand-soft)' : 'var(--surface)',
                borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 14.5, fontWeight: 800, color: on ? 'var(--brand-ink)' : 'var(--ink-2)',
                transition: 'all .15s ease',
              }}>
                <_POI name={p.icon} size={17} color={on ? 'var(--brand-ink)' : 'var(--muted)'} />
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Room link */}
        <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', marginBottom: 8 }}>Room name or invite link</div>
        <input
          value={link} onChange={e => setLink(e.target.value)}
          placeholder={plat.ph} autoCapitalize="none" autoCorrect="off"
          style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', marginBottom: 22,
            border: '1.5px solid var(--line)', borderRadius: 14, background: 'var(--surface)',
            fontFamily: 'inherit', fontSize: 14.5, fontWeight: 600, color: 'var(--ink)', outline: 'none' }}
          onFocus={e => e.target.style.borderColor = 'var(--brand)'}
          onBlur={e => e.target.style.borderColor = 'var(--line)'}
        />

        {/* Connection picker */}
        <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', marginBottom: 10 }}>
          Invite connections{selected.size > 0 ? ` · ${selected.size} selected` : ''}
        </div>

        {connections.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 14, color: 'var(--muted)', fontWeight: 600, lineHeight: 1.55 }}>
            Connect with other players to invite them to your game.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {connections.map(c => {
              const p = _POMM.byId(c.playerId);
              if (!p) return null;
              const on = selected.has(c.id);
              return (
                <button key={c.id} onClick={() => toggle(c.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
                  padding: '11px 14px', border: `1.5px solid ${on ? 'var(--brand)' : 'var(--line)'}`,
                  background: on ? 'var(--brand-soft)' : 'var(--surface)', borderRadius: 14,
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s ease',
                  WebkitTapHighlightColor: 'transparent',
                }}>
                  <_POAv player={p} size={38} ring={2} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1, fontWeight: 600 }}>Met at {c.metAt}</div>
                  </div>
                  <div style={{
                    width: 22, height: 22, borderRadius: 7, flexShrink: 0,
                    border: `2px solid ${on ? 'var(--brand)' : 'var(--line-strong)'}`,
                    background: on ? 'var(--brand)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s ease',
                  }}>
                    {on && <_POI name="check" size={13} color="var(--on-brand)" stroke={3} />}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Sticky send footer */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0,
        padding: '14px 18px 30px', background: 'var(--bg)', borderTop: '1px solid var(--line)' }}>
        {sent ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
            height: 52, color: '#4ade80', fontSize: 15, fontWeight: 750 }}>
            <_POI name="check" size={20} color="#4ade80" stroke={2.4} />
            {selected.size} player{selected.size !== 1 ? 's' : ''} notified with your room link!
          </div>
        ) : (
          <button onClick={handleSend} disabled={!canSend} style={{
            width: '100%', height: 52, border: 'none', cursor: canSend ? 'pointer' : 'default',
            fontFamily: 'inherit', fontSize: 15, fontWeight: 800, borderRadius: 'var(--r-lg)',
            background: canSend ? 'var(--brand)' : 'var(--chip-bg)',
            color: canSend ? 'var(--on-brand)' : 'var(--muted)',
            boxShadow: canSend ? '0 6px 20px var(--brand-shadow)' : 'none',
            transition: 'all .2s ease',
          }}>
            {selected.size > 0 && link.trim()
              ? `Send to ${selected.size} player${selected.size !== 1 ? 's' : ''} \u2192`
              : 'Add a link and select players'}
          </button>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { PlayOnlineSheet });
