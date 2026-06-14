// manamap — Pod formation (first-class). Exports PodsSection, PodCreateSheet,
// PodScreen, podFit. Depends on window globals.
const { Avatar: _PAv, ManaRow: _PMR, Icon: _PI, Button: _PB, comboName: _Pcn } = window;
const _MMp = window.MM;
const { useState: _pus } = React;

// ── compatibility ─────────────────────────────────────────
// player: a PLAYERS row or ME (has .formats, .power, .colors)
function podFit(pod, player) {
  const fmtMatch = (player.formats || []).includes(pod.format);
  const power = Number(player.power);
  const diff = Math.abs(power - pod.targetPower);
  if (!fmtMatch) {
    return { tier: 'off', label: 'Different format', reason: `Plays ${player.formats[0]}, not ${pod.format}` };
  }
  if (diff <= pod.tolerance) {
    return { tier: 'great', label: 'Great fit', reason: `Power ${player.power} is in ${pod.targetPower}±${pod.tolerance}` };
  }
  if (diff <= pod.tolerance + 1) {
    return { tier: 'close', label: 'Close', reason: `Power ${player.power} is just outside ${pod.targetPower}±${pod.tolerance}` };
  }
  return { tier: 'off', label: 'Power off', reason: `Power ${player.power} vs target ${pod.targetPower}±${pod.tolerance}` };
}

const FIT_STYLE = {
  great: { bg: 'var(--brand-soft)', fg: 'var(--brand-ink)', dot: 'var(--brand)' },
  close: { bg: 'rgba(224,153,46,0.16)', fg: 'oklch(0.7 0.12 75)', dot: 'oklch(0.72 0.14 75)' },
  off: { bg: 'rgba(220,90,80,0.15)', fg: 'oklch(0.68 0.13 25)', dot: 'oklch(0.68 0.15 25)' },
};

function FitBadge({ tier, label }) {
  const s = FIT_STYLE[tier];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 800,
      color: s.fg, background: s.bg, padding: '3px 10px', borderRadius: 999, whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: s.dot, flexShrink: 0 }} />{label}
    </span>
  );
}

function PowerChip({ pod }) {
  return <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)', background: 'var(--chip-bg)', padding: '4px 11px', borderRadius: 999 }}>Power {pod.targetPower} ±{pod.tolerance}</span>;
}
function FmtChip({ children }) {
  return <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)', background: 'var(--chip-bg)', padding: '4px 11px', borderRadius: 999 }}>{children}</span>;
}

function resolve(id, me) { return id === 'me' ? me : _MMp.byId(id); }

// ── seat row ──────────────────────────────────────────────
function SeatRow({ pod, seated, me }) {
  const open = Math.max(0, pod.seats - seated.length);
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {seated.map((id, i) => {
        const p = resolve(id, me);
        const role = id === pod.hostId ? 'Host' : id === 'me' ? 'You' : (p.name.split(' ')[0]);
        return (
          <div key={id} style={{ flex: 1, textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '11px 4px 9px' }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}><_PAv player={p} size={38} /></div>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--ink)', marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{role}</div>
          </div>
        );
      })}
      {Array.from({ length: open }).map((_, i) => (
        <div key={'o' + i} style={{ flex: 1, textAlign: 'center', border: '1.5px dashed var(--line-strong)', borderRadius: 'var(--r-md)', padding: '11px 4px 9px', minHeight: 78, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <div style={{ width: 38, height: 38, borderRadius: 999, background: 'var(--chip-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <_PI name="plus" size={18} color="var(--muted)" stroke={2.4} />
          </div>
          <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Open</div>
        </div>
      ))}
    </div>
  );
}

// ── Discover: "Pods forming here" ─────────────────────────
function PodsSection({ pods, me, onOpenPod, onStart }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 2px 10px' }}>
        <span style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--muted)' }}>Pods forming here</span>
        {pods.length ? <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--brand-ink)', background: 'var(--brand-soft)', padding: '1px 8px', borderRadius: 999 }}>{pods.length}</span> : null}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {pods.map(pod => {
          const host = resolve(pod.hostId, me);
          const filled = pod.filledIds.length;
          const fit = podFit(pod, me);
          const full = filled >= pod.seats;
          return (
            <button key={pod.id} onClick={() => onOpenPod(pod)} style={{
              display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
              background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', padding: 14, boxShadow: 'var(--shadow-card)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <_PAv player={host} size={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{pod.hostId === 'me' ? 'Your pod' : `${host.name}\u2019s pod`}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <_PI name="pin" size={12} color="var(--muted)" /> {pod.where}
                  </div>
                </div>
                {!full && pod.hostId !== 'me' ? <FitBadge tier={fit.tier} label={fit.tier === 'great' ? 'Great fit' : fit.tier === 'close' ? 'Close' : 'Check power'} /> : null}
                {full ? <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)' }}>Full</span> : null}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 11, flexWrap: 'wrap' }}>
                <FmtChip>{pod.format}</FmtChip>
                <PowerChip pod={pod} />
                <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 800, color: full ? 'var(--muted)' : 'var(--brand-ink)' }}>{filled}/{pod.seats} seated</span>
              </div>
            </button>
          );
        })}
      </div>

      <button onClick={onStart} style={{
        width: '100%', marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        padding: '13px', borderRadius: 'var(--r-md)', border: '1.5px dashed var(--line-strong)', background: 'none',
        cursor: 'pointer', fontFamily: 'inherit', fontSize: 14.5, fontWeight: 750, color: 'var(--brand-ink)',
      }}>
        <_PI name="plus" size={18} stroke={2.4} /> Start a pod
      </button>
    </div>
  );
}

// ── Create sheet ──────────────────────────────────────────
function PodCreateSheet({ me, onCreate, onClose }) {
  const [format, setFormat] = _pus('Commander');
  const [power, setPower] = _pus(7);
  const [tol, setTol] = _pus(1);
  const [seats, setSeats] = _pus(4);
  const [where, setWhere] = _pus('');
  const [note, setNote] = _pus('');
  const FORMATS = ['Commander', 'Modern', 'Brawl', 'Draft'];

  return (
    <div style={{ padding: '6px 20px 28px' }}>
      <div style={{ width: 40, height: 5, borderRadius: 999, background: 'var(--line-strong)', margin: '0 auto 16px' }} />
      <div style={{ fontSize: 22, fontWeight: 850, letterSpacing: '-0.025em', color: 'var(--ink)' }}>Start a pod</div>
      <div style={{ fontSize: 14, color: 'var(--ink-2)', fontWeight: 600, marginTop: 5, marginBottom: 20, lineHeight: 1.45 }}>Players here can ask to join — you approve each seat.</div>

      <_PodLabel>Format</_PodLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        {FORMATS.map(f => <button key={f} onClick={() => setFormat(f)} style={_podPill(f === format)}>{f}</button>)}
      </div>

      <_PodLabel>Target power — <span style={{ color: 'var(--brand-ink)' }}>{power}/10</span></_PodLabel>
      <input type="range" min="1" max="10" value={power} onChange={e => setPower(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--brand)', marginBottom: 18 }} />

      <_PodLabel>Tolerance</_PodLabel>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[1, 2, 3].map(n => <button key={n} onClick={() => setTol(n)} style={{ ..._podPill(n === tol), flex: 1 }}>±{n}</button>)}
      </div>

      <_PodLabel>Seats</_PodLabel>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[2, 3, 4].map(n => <button key={n} onClick={() => setSeats(n)} style={{ ..._podPill(n === seats), flex: 1 }}>{n}</button>)}
      </div>

      <_PodLabel>Where to meet</_PodLabel>
      <input value={where} onChange={e => setWhere(e.target.value)} placeholder="Table 4, back corner, by the windows…" maxLength={40} style={_podInput} onFocus={e => e.target.style.borderColor = 'var(--brand)'} onBlur={e => e.target.style.borderColor = 'var(--line)'} />

      <_PodLabel>Note <span style={{ color: 'var(--muted)', fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></_PodLabel>
      <input value={note} onChange={e => setNote(e.target.value)} placeholder="Rule-0 notes, house rules…" maxLength={70} style={_podInput} onFocus={e => e.target.style.borderColor = 'var(--brand)'} onBlur={e => e.target.style.borderColor = 'var(--line)'} />

      <_PB variant="primary" full icon="sparkle" onClick={() => onCreate({
        id: 'mine', hostId: 'me', format, targetPower: power, tolerance: tol, seats,
        filledIds: ['me'], requests: [], where: where.trim() || 'I\u2019ll message the spot', note: note.trim(), mins: 60,
      })}>Create pod</_PB>
    </div>
  );
}

// ── Pod detail / manage screen (pushed) ───────────────────
function PodScreen({ pod, isHost, me, onToast, onClose, onLogResult, onLifeTracker }) {
  const [seated, setSeated] = _pus(pod.filledIds);
  const [requests, setRequests] = _pus(pod.requests);
  const [invited, setInvited] = _pus([]);
  const [asked, setAsked] = _pus(false);

  const full = seated.length >= pod.seats;
  const need = pod.seats - seated.length;
  const host = resolve(pod.hostId, me);

  const approve = (pid) => { if (seated.length < pod.seats) { setSeated(s => [...s, pid]); setRequests(r => r.filter(x => x !== pid)); onToast(`${_MMp.byId(pid).name} seated`); } };
  const decline = (pid) => { setRequests(r => r.filter(x => x !== pid)); };
  const invite = (pid) => { setInvited(iv => [...iv, pid]); onToast(`Invite sent to ${_MMp.byId(pid).name}`); };
  const ask = () => { setAsked(true); onToast(`Request sent to ${host.name}`); };

  // suggestions to invite (host): open players not already seated/requested/invited
  const candidates = _MMp.LFG
    .map(s => _MMp.byId(s.playerId))
    .filter(p => p && !seated.includes(p.id) && !requests.includes(p.id))
    .map(p => ({ p, fit: podFit(pod, p) }))
    .sort((a, b) => ({ great: 0, close: 1, off: 2 }[a.fit.tier] - { great: 0, close: 1, off: 2 }[b.fit.tier]));

  const myFit = isHost ? null : podFit(pod, me);

  return (
    <div style={{ padding: '4px 16px 28px' }}>
      {/* status banner */}
      <div style={{
        background: full ? 'var(--brand)' : 'var(--surface)', border: full ? 'none' : '1px solid var(--line)',
        borderRadius: 'var(--r-lg)', padding: full ? '16px 18px' : '14px 16px', marginBottom: 16,
        boxShadow: 'var(--shadow-card)',
      }}>
        {full ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <span style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <_PI name="check" size={22} color="var(--on-brand)" stroke={2.8} />
            </span>
            <div>
              <div style={{ fontSize: 17, fontWeight: 850, color: 'var(--on-brand)', letterSpacing: '-0.01em' }}>Pod ready!</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--on-brand)', opacity: 0.9, marginTop: 1 }}>All {pod.seats} seats filled — go play.</div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ position: 'relative', width: 10, height: 10, flexShrink: 0 }}>
              <span style={{ position: 'absolute', inset: 0, borderRadius: 999, background: 'var(--brand)' }} />
              <span style={{ position: 'absolute', inset: -4, borderRadius: 999, border: '2px solid var(--brand)', animation: 'mm-pulse 2s ease-out infinite' }} />
            </span>
            <span style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{pod.hostId === 'me' ? 'Your pod' : `${host.name}\u2019s pod`}</span>
            <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 800, color: 'var(--brand-ink)', background: 'var(--brand-soft)', padding: '3px 10px', borderRadius: 999 }}>Need {need} more</span>
          </div>
        )}
      </div>

      {/* meta */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12, flexWrap: 'wrap' }}>
        <FmtChip>{pod.format}</FmtChip>
        <PowerChip pod={pod} />
      </div>

      {/* where to meet */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '12px 14px', marginBottom: 16, boxShadow: 'var(--shadow-row)' }}>
        <div style={{ width: 36, height: 36, borderRadius: 11, background: 'var(--brand-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <_PI name="pin" size={19} color="var(--brand-ink)" />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--muted)' }}>Where to meet</div>
          <div style={{ fontSize: 15, fontWeight: 750, color: 'var(--ink)', marginTop: 1 }}>{pod.where}</div>
        </div>
      </div>

      {/* seats */}
      <_PodLabel>Seats</_PodLabel>
      <div style={{ marginBottom: 18 }}><SeatRow pod={pod} seated={seated} me={me} /></div>

      {pod.note ? (
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-2)', lineHeight: 1.5, background: 'var(--chip-bg)', borderRadius: 12, padding: '11px 14px', marginBottom: 18 }}>“{pod.note}”</div>
      ) : null}

      {/* JOINER: fit + ask */}
      {!isHost && (
        <>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11, background: FIT_STYLE[myFit.tier].bg, borderRadius: 'var(--r-md)', padding: '13px 15px', marginBottom: 16 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: FIT_STYLE[myFit.tier].dot, marginTop: 5, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: FIT_STYLE[myFit.tier].fg }}>{myFit.tier === 'great' ? 'You\u2019re a great fit' : myFit.tier === 'close' ? 'You\u2019re close on power' : 'Heads up on fit'}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', marginTop: 2, lineHeight: 1.4 }}>{myFit.reason}</div>
            </div>
          </div>
          {full ? (
            <div style={{ textAlign: 'center', fontSize: 14, fontWeight: 700, color: 'var(--muted)', padding: '8px 0' }}>This pod is full.</div>
          ) : asked ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, background: 'var(--surface)', border: '1.5px solid var(--line)', borderRadius: 'var(--r-btn)', padding: 14, color: 'var(--ink-2)', fontWeight: 750, fontSize: 15 }}>
              <_PI name="check" size={18} color="var(--brand)" /> Request sent — waiting for {host.name}
            </div>
          ) : (
            <_PB variant="primary" full icon="plus" onClick={ask}>Ask to join</_PB>
          )}
        </>
      )}

      {/* HOST: requests + invite */}
      {isHost && !full && (
        <>
          {requests.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <_PodLabel>Join requests <span style={{ color: 'var(--brand-ink)' }}>{requests.length}</span></_PodLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {requests.map(pid => {
                  const p = _MMp.byId(pid); const fit = podFit(pod, p);
                  return (
                    <div key={pid} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: 12, boxShadow: 'var(--shadow-row)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                        <_PAv player={p} size={42} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>{p.name}</div>
                          <div style={{ marginTop: 4 }}><FitBadge tier={fit.tier} label={fit.label} /></div>
                        </div>
                      </div>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)', margin: '9px 0 0', lineHeight: 1.4 }}>{fit.reason}</div>
                      <div style={{ display: 'flex', gap: 9, marginTop: 11 }}>
                        <_PB variant="ghost" size="sm" full onClick={() => decline(pid)}>Decline</_PB>
                        <_PB variant="primary" size="sm" full icon="check" onClick={() => approve(pid)}>Approve</_PB>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <_PodLabel>Invite players here</_PodLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {candidates.map(({ p, fit }) => {
              const isInv = invited.includes(p.id);
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 11, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: 11, boxShadow: 'var(--shadow-row)' }}>
                  <_PAv player={p} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--ink)' }}>{p.name}</div>
                    <div style={{ marginTop: 4 }}><FitBadge tier={fit.tier} label={fit.label} /></div>
                  </div>
                  <button onClick={() => !isInv && invite(p.id)} disabled={isInv} style={{
                    border: 'none', cursor: isInv ? 'default' : 'pointer', fontFamily: 'inherit', fontWeight: 750, fontSize: 13,
                    padding: '8px 15px', borderRadius: 999, flexShrink: 0,
                    background: isInv ? 'var(--brand-soft)' : 'var(--brand)', color: isInv ? 'var(--brand-ink)' : 'var(--on-brand)',
                  }}>{isInv ? 'Invited' : 'Invite'}</button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* HOST or member, full → ready actions */}
      {full && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
          {onLogResult ? <_PB variant="primary" full icon="check" onClick={onLogResult}>Log result when you\u2019re done</_PB> : null}
          {onLifeTracker ? <_PB variant="ghost" full icon="swords" onClick={onLifeTracker}>Life Tracker</_PB> : null}
          <_PB variant="ghost" full icon="discord" onClick={() => onToast('Pod thread opened')}>Message the pod</_PB>
          <_PB variant="ghost" full onClick={onClose}>Done</_PB>
        </div>
      )}
    </div>
  );
}

function _PodLabel({ children }) {
  return <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>{children}</div>;
}
function _podPill(on) {
  return { padding: '10px 15px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
    border: on ? '1.5px solid var(--brand)' : '1.5px solid var(--line)',
    background: on ? 'var(--brand-soft)' : 'var(--surface)', color: on ? 'var(--brand-ink)' : 'var(--ink-2)', transition: 'all .14s ease' };
}
const _podInput = { width: '100%', boxSizing: 'border-box', padding: '13px 15px', fontSize: 15, fontFamily: 'inherit', fontWeight: 600,
  color: 'var(--ink)', background: 'var(--surface)', border: '1.5px solid var(--line)', borderRadius: 'var(--r-md)', outline: 'none', marginBottom: 20 };

Object.assign(window, { PodsSection, PodCreateSheet, PodScreen, podFit });
