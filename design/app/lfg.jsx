// manamap — LFG ("Open to play now"). Exports LFGStatusBar, LFGSection,
// LFGComposer, PodSheet. Depends on window globals.
const { Avatar: _Av, ManaRow: _MR, Icon: _I, Button: _B, comboName: _cn, Segmented: _Seg } = window;
const _MMl = window.MM;
const { useState: _us } = React;

const FORMAT_OPTS = ['Commander', 'Modern', 'Standard', 'Brawl', 'Draft', 'Pioneer'];
const DURATIONS = [
  { v: 30, label: '30 min' }, { v: 60, label: '1 hr' }, { v: 120, label: '2 hr' },
];

function fmtMins(m) {
  if (m >= 60) { const h = Math.floor(m / 60), r = m % 60; return r ? `${h}h ${r}m` : `${h}h`; }
  return `${m}m`;
}

// ── Live status bar / CTA at top of Discover ──────────────
function LFGStatusBar({ open, session, onGoOpen, onEdit, onStop }) {
  if (!open) {
    return (
      <button onClick={onGoOpen} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 13, cursor: 'pointer', fontFamily: 'inherit',
        background: 'var(--brand)', border: 'none', borderRadius: 'var(--r-lg)', padding: '15px 17px',
        boxShadow: '0 6px 20px var(--brand-shadow)', textAlign: 'left', marginBottom: 16,
      }}>
        <span style={{ width: 42, height: 42, borderRadius: 13, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <_I name="sparkle" size={23} color="var(--on-brand)" stroke={2.2} />
        </span>
        <span style={{ flex: 1 }}>
          <span style={{ display: 'block', fontSize: 16.5, fontWeight: 800, color: 'var(--on-brand)', letterSpacing: '-0.01em' }}>Open to play now</span>
          <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--on-brand)', opacity: 0.85, marginTop: 1 }}>Let players here know you want a game</span>
        </span>
        <_I name="arrowR" size={20} color="var(--on-brand)" stroke={2.4} />
      </button>
    );
  }
  return (
    <div style={{
      background: 'var(--surface)', border: '1.5px solid var(--brand)', borderRadius: 'var(--r-lg)',
      padding: '14px 16px', marginBottom: 16, boxShadow: 'var(--shadow-card)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ position: 'relative', width: 10, height: 10, flexShrink: 0 }}>
          <span style={{ position: 'absolute', inset: 0, borderRadius: 999, background: 'var(--brand)' }} />
          <span style={{ position: 'absolute', inset: -4, borderRadius: 999, border: '2px solid var(--brand)', animation: 'mm-pulse 2s ease-out infinite' }} />
        </span>
        <span style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.01em' }}>You’re open to play</span>
        <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 800, color: 'var(--brand-ink)', background: 'var(--brand-soft)', padding: '3px 10px', borderRadius: 999 }}>{fmtMins(session.mins)} left</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 10, flexWrap: 'wrap' }}>
        <_Tag>{session.format}</_Tag>
        <_Tag>Power {session.power}</_Tag>
        <_Tag>{session.seats} {session.seats === 1 ? 'seat' : 'seats'} open</_Tag>
      </div>
      <div style={{ display: 'flex', gap: 9, marginTop: 13 }}>
        <_B variant="ghost" size="sm" full onClick={onEdit}>Edit</_B>
        <_B variant="danger" size="sm" full onClick={onStop}>Stop</_B>
      </div>
    </div>
  );
}

function _Tag({ children }) {
  return <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)', background: 'var(--chip-bg)', padding: '4px 11px', borderRadius: 999 }}>{children}</span>;
}

// ── "Open to play now" list section ───────────────────────
function LFGSection({ sessions, onJoin, onOpenPlayer }) {
  if (!sessions.length) return null;
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 2px 10px' }}>
        <span style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--muted)' }}>Open to play now</span>
        <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--brand-ink)', background: 'var(--brand-soft)', padding: '1px 8px', borderRadius: 999 }}>{sessions.length}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sessions.map(s => {
          const p = _MMl.byId(s.playerId);
          return (
            <div key={s.playerId} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', padding: 14, boxShadow: 'var(--shadow-card)' }}>
              <button onClick={() => onOpenPlayer(p)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
                <div style={{ position: 'relative' }}>
                  <_Av player={p} size={48} />
                  <span style={{ position: 'absolute', bottom: -1, right: -1, width: 14, height: 14, borderRadius: 999, background: 'var(--brand)', border: '2.5px solid var(--surface)' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.02em' }}>{p.name}</span>
                    {p.metBefore && <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--brand-ink)', background: 'var(--brand-soft)', padding: '1px 6px', borderRadius: 999 }}>MET</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
                    <_MR colors={p.colors} size={15} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>{_cn(p.colors)}</span>
                  </div>
                </div>
                <span style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 800, color: 'var(--brand-ink)' }}>{fmtMins(s.mins)}</span>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>left</span>
                </span>
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 12, flexWrap: 'wrap' }}>
                <_Tag>{s.format}</_Tag>
                <_Tag>Power {s.power}</_Tag>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--brand-ink)', background: 'var(--brand-soft)', padding: '4px 11px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <_I name="user" size={13} color="var(--brand-ink)" /> {s.seats} {s.seats === 1 ? 'seat' : 'seats'}
                </span>
              </div>
              {s.note ? <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', lineHeight: 1.45, marginTop: 11, background: 'var(--chip-bg)', borderRadius: 12, padding: '9px 12px' }}>“{s.note}”</div> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Composer sheet (go open / edit) ───────────────────────
function LFGComposer({ initial, onPublish, onClose }) {
  const [format, setFormat] = _us(initial ? initial.format : 'Commander');
  const [power, setPower] = _us(initial ? Number(initial.power) : 7);
  const [seats, setSeats] = _us(initial ? initial.seats : 3);
  const [mins, setMins] = _us(initial ? (initial.mins > 90 ? 120 : initial.mins > 45 ? 60 : 30) : 60);
  const [note, setNote] = _us(initial ? initial.note : '');

  return (
    <div style={{ padding: '6px 20px 28px' }}>
      <div style={{ width: 40, height: 5, borderRadius: 999, background: 'var(--line-strong)', margin: '0 auto 16px' }} />
      <div style={{ fontSize: 22, fontWeight: 850, letterSpacing: '-0.025em', color: 'var(--ink)' }}>{initial ? 'Edit your status' : 'Open to play'}</div>
      <div style={{ fontSize: 14, color: 'var(--ink-2)', fontWeight: 600, marginTop: 5, marginBottom: 20, lineHeight: 1.45 }}>Players at Dragon’s Den will see you’re looking for a game.</div>

      <_OBLabel>Format</_OBLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        {FORMAT_OPTS.map(f => {
          const on = f === format;
          return <button key={f} onClick={() => setFormat(f)} style={_pill(on)}>{f}</button>;
        })}
      </div>

      <_OBLabel>Power level — <span style={{ color: 'var(--brand-ink)' }}>{power}/10</span></_OBLabel>
      <input type="range" min="1" max="10" value={power} onChange={e => setPower(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--brand)', marginBottom: 22 }} />

      <_OBLabel>Seats open</_OBLabel>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[1, 2, 3].map(n => {
          const on = n === seats;
          return <button key={n} onClick={() => setSeats(n)} style={{ ..._pill(on), flex: 1 }}>{n} {n === 1 ? 'seat' : 'seats'}</button>;
        })}
      </div>

      <_OBLabel>Stay open for</_OBLabel>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {DURATIONS.map(d => {
          const on = d.v === mins;
          return <button key={d.v} onClick={() => setMins(d.v)} style={{ ..._pill(on), flex: 1 }}>{d.label}</button>;
        })}
      </div>

      <_OBLabel>Note <span style={{ color: 'var(--muted)', fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></_OBLabel>
      <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Table 4, bring a fast deck" maxLength={60} style={{
        width: '100%', boxSizing: 'border-box', padding: '13px 15px', fontSize: 15, fontFamily: 'inherit', fontWeight: 600,
        color: 'var(--ink)', background: 'var(--surface)', border: '1.5px solid var(--line)', borderRadius: 'var(--r-md)', outline: 'none', marginBottom: 24,
      }} onFocus={e => e.target.style.borderColor = 'var(--brand)'} onBlur={e => e.target.style.borderColor = 'var(--line)'} />

      <_B variant="primary" full icon={initial ? 'check' : 'sparkle'} onClick={() => onPublish({ format, power: String(power), seats, mins, note })}>
        {initial ? 'Update status' : 'Go open'}
      </_B>
    </div>
  );
}

function _OBLabel({ children }) {
  return <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>{children}</div>;
}
function _pill(on) {
  return {
    padding: '10px 15px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
    border: on ? '1.5px solid var(--brand)' : '1.5px solid var(--line)',
    background: on ? 'var(--brand-soft)' : 'var(--surface)', color: on ? 'var(--brand-ink)' : 'var(--ink-2)',
    transition: 'all .14s ease',
  };
}

// ── Pod formation sheet ───────────────────────────────────
function PodSheet({ host, session, me, onClose, onInvite }) {
  // seats: host + me are filled; remaining = seats. Suggest from other open players.
  const hostP = host;
  const suggestions = _MMl.LFG
    .filter(s => s.playerId !== host.id)
    .map(s => ({ p: _MMl.byId(s.playerId), s }))
    .slice(0, 3);
  const podSize = session.seats + 2; // host + you + the open seats they wanted
  const [invited, setInvited] = _us([]);
  const filled = 2 + invited.length;

  return (
    <div style={{ padding: '6px 20px 28px' }}>
      <div style={{ width: 40, height: 5, borderRadius: 999, background: 'var(--line-strong)', margin: '0 auto 16px' }} />
      <div style={{ fontSize: 22, fontWeight: 850, letterSpacing: '-0.025em', color: 'var(--ink)' }}>Form a pod</div>
      <div style={{ fontSize: 14, color: 'var(--ink-2)', fontWeight: 600, marginTop: 5, marginBottom: 18, lineHeight: 1.45 }}>
        {hostP.name}’s {session.format} game · power {session.power} · {filled} of {podSize} seated
      </div>

      {/* seats row */}
      <div style={{ display: 'flex', gap: 9, marginBottom: 20 }}>
        <_Seat p={hostP} role="Host" />
        <_Seat p={me} role="You" />
        {invited.map((pid) => <_Seat key={pid} p={_MMl.byId(pid)} role="Invited" />)}
        {Array.from({ length: Math.max(0, podSize - filled) }).map((_, i) => <_EmptySeat key={i} />)}
      </div>

      {podSize - filled > 0 ? (
        <>
          <_OBLabel>Suggested players here</_OBLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 8 }}>
            {suggestions.map(({ p, s }) => {
              const isIn = invited.includes(p.id);
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: 11, boxShadow: 'var(--shadow-row)' }}>
                  <_Av player={p} size={42} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>{p.name}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginTop: 2 }}>{s.format} · power {s.power}</div>
                  </div>
                  <button onClick={() => setInvited(iv => isIn ? iv.filter(x => x !== p.id) : (filled < podSize ? [...iv, p.id] : iv))} disabled={!isIn && filled >= podSize} style={{
                    border: 'none', cursor: (!isIn && filled >= podSize) ? 'default' : 'pointer', fontFamily: 'inherit', fontWeight: 750, fontSize: 13,
                    padding: '8px 14px', borderRadius: 999, flexShrink: 0,
                    background: isIn ? 'var(--brand-soft)' : 'var(--brand)', color: isIn ? 'var(--brand-ink)' : 'var(--on-brand)',
                    opacity: (!isIn && filled >= podSize) ? 0.4 : 1,
                  }}>{isIn ? '✓ Added' : 'Add'}</button>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'var(--brand-soft)', borderRadius: 'var(--r-md)', padding: '13px 15px', marginBottom: 4 }}>
          <_I name="check" size={20} color="var(--brand-ink)" stroke={2.6} />
          <span style={{ fontSize: 14, fontWeight: 750, color: 'var(--brand-ink)' }}>Pod’s full — you’re good to go!</span>
        </div>
      )}

      <div style={{ marginTop: 18 }}>
        <_B variant="primary" full icon="discord" onClick={() => onInvite(hostP, invited)}>
          {podSize - filled > 0 ? `Send pod invite to ${hostP.name}` : 'Lock in pod'}
        </_B>
      </div>
    </div>
  );
}

function _Seat({ p, role }) {
  return (
    <div style={{ flex: 1, textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '12px 6px 10px' }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}><_Av player={p} size={40} /></div>
      <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--ink)', marginTop: 7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--brand-ink)', textTransform: 'uppercase', letterSpacing: '0.03em', marginTop: 1 }}>{role}</div>
    </div>
  );
}
function _EmptySeat() {
  return (
    <div style={{ flex: 1, textAlign: 'center', border: '1.5px dashed var(--line-strong)', borderRadius: 'var(--r-md)', padding: '12px 6px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 92 }}>
      <div style={{ width: 40, height: 40, borderRadius: 999, background: 'var(--chip-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <_I name="plus" size={20} color="var(--muted)" stroke={2.4} />
      </div>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.03em', marginTop: 7 }}>Open</div>
    </div>
  );
}

Object.assign(window, { LFGStatusBar, LFGSection, LFGComposer, PodSheet });
