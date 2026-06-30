// manamap — Stores screen (M35). Map + list + StoreDetailSheet.
// Exports StoresScreen.
const { useState, useEffect } = React;
const { Icon: _StI, Avatar: _StAv, manaAccent: _Stma, ManaPip: _StPip, manaGradient: _Stmg, readableOn: _StRdOn } = window;
const _StMM = window.MM;

const SRC_COLOR = { STORE: 'var(--brand)', DISCORD: '#5865F2', WIZARDS: '#9333ea' };

// Stores have no brand color of their own — derive a stable WUBRG identity
// accent from the store id so the reward celebration reads as "this store",
// not a generic brand-green button. Falls back to the brand accent.
const _StAccentLetters = ['W', 'U', 'B', 'R', 'G'];
function storeAccent(store) {
  if (!store) return 'var(--brand)';
  let hash = 0;
  for (let i = 0; i < store.id.length; i++) hash = (hash * 31 + store.id.charCodeAt(i)) | 0;
  return _Stma([_StAccentLetters[Math.abs(hash) % _StAccentLetters.length]]);
}

// ── Fake QR code (design placeholder) ──────────────────
function FakeQR({ code = 'MM-1A2B3C', size = 130 }) {
  const cells = 11, cell = (size - 16) / cells;
  const hash = code.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0);
  const filled = (x, y) => {
    // Corner finder squares (3×3 at three corners)
    if ((x < 3 && y < 3) || (x > cells - 4 && y < 3) || (x < 3 && y > cells - 4)) return true;
    return Math.abs((hash + (x * 7 + y * 13) * 4099) % 100) < 48;
  };
  return (
    <div style={{ background: '#fff', padding: 8, borderRadius: 12, display: 'inline-block', lineHeight: 0 }}>
      <svg width={cells * cell} height={cells * cell}>
        {Array.from({ length: cells }, (_, y) =>
          Array.from({ length: cells }, (_, x) =>
            filled(x, y) ? (
              <rect key={`${x}-${y}`} x={x * cell + 0.5} y={y * cell + 0.5}
                width={cell - 1} height={cell - 1} fill="#111" rx="1" />
            ) : null
          )
        )}
      </svg>
    </div>
  );
}

// ── Pseudo map ─────────────────────────────────────────
function PseudoMap({ stores, checkedInId, selectedId, onSelect }) {
  const activeStore = stores.find(s => s.id === checkedInId);
  return (
    <div style={{
      flex: 1, position: 'relative', overflow: 'hidden',
      background: 'color-mix(in oklch, var(--bg) 55%, oklch(0.78 0.04 72) 45%)',
      backgroundImage: [
        'repeating-linear-gradient(0deg, color-mix(in srgb,var(--surface) 60%,transparent) 0 1.5px, transparent 1.5px 56px)',
        'repeating-linear-gradient(90deg, color-mix(in srgb,var(--surface) 60%,transparent) 0 1.5px, transparent 1.5px 56px)',
      ].join(','),
    }}>
      {/* Diagonal main road */}
      <div style={{ position: 'absolute', left: '20%', top: '35%', width: '120%', height: 10,
        background: 'color-mix(in srgb,var(--surface) 85%,transparent)', transform: 'rotate(-15deg)',
        transformOrigin: 'left center' }} />
      <div style={{ position: 'absolute', left: '10%', top: '58%', width: '100%', height: 7,
        background: 'color-mix(in srgb,var(--surface) 75%,transparent)', transform: 'rotate(8deg)',
        transformOrigin: 'left center' }} />

      {/* Store pins */}
      {stores.map(s => {
        const isActive = s.id === checkedInId;
        const isSelected = s.id === selectedId;
        const isProposed = s.status === 'PROPOSED';
        return (
          <button key={s.id} onClick={() => onSelect(s.id)} style={{
            position: 'absolute', left: `${s.x}%`, top: `${s.y}%`,
            transform: 'translate(-50%, -50%)',
            border: 'none', background: 'none', cursor: 'pointer', padding: 8,
            WebkitTapHighlightColor: 'transparent',
          }}>
            {isActive && (
              <div style={{ position: 'absolute', inset: -6, borderRadius: 999,
                background: 'rgba(74,222,128,0.22)', animation: 'mm-pulse 2s ease-out infinite' }} />
            )}
            <div style={{
              width: isSelected ? 18 : 14, height: isSelected ? 18 : 14,
              borderRadius: 999, transition: 'all .2s ease',
              background: isActive ? '#4ade80' : isProposed ? '#9CA3AF' : 'var(--brand)',
              border: `${isSelected ? 3 : 2}px solid var(--surface)`,
              boxShadow: isActive ? '0 2px 10px rgba(74,222,128,0.55)' : '0 2px 8px rgba(0,0,0,0.22)',
            }} />
            {isSelected && (
              <div style={{
                position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
                background: 'var(--surface)', borderRadius: 8, padding: '4px 8px', whiteSpace: 'nowrap',
                fontSize: 11, fontWeight: 800, color: 'var(--ink)', boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                marginBottom: 2, border: '1px solid var(--line)',
              }}>{s.name}</div>
            )}
          </button>
        );
      })}

      {/* User dot */}
      <div style={{ position: 'absolute', left: '49%', top: '43%', transform: 'translate(-50%,-50%)', pointerEvents: 'none' }}>
        <div style={{ width: 14, height: 14, borderRadius: 999, background: 'var(--brand)',
          border: '3px solid var(--surface)', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }} />
      </div>

      {/* Add store FAB */}
      <button onClick={() => {}} style={{
        position: 'absolute', bottom: 16, left: 16, display: 'flex', alignItems: 'center', gap: 6,
        background: 'var(--brand)', color: 'var(--on-brand)', border: 'none', cursor: 'pointer',
        padding: '9px 16px', borderRadius: 999, fontSize: 13, fontWeight: 800,
        boxShadow: '0 4px 16px var(--brand-shadow)', fontFamily: 'inherit',
      }}>
        <_StI name="plus" size={16} color="var(--on-brand)" stroke={2.6} /> Add store
      </button>
    </div>
  );
}

// ── List view ──────────────────────────────────────────
function StoreListView({ stores, query, checkedInId, onSelect }) {
  const filtered = query.trim().length < 1
    ? stores
    : stores.filter(s => s.name.toLowerCase().includes(query.toLowerCase()) || s.city.toLowerCase().includes(query.toLowerCase()));
  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {filtered.map(s => {
        const active = s.id === checkedInId;
        return (
          <button key={s.id} onClick={() => onSelect(s.id)} style={{
            display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
            padding: '12px 18px', border: 'none', fontFamily: 'inherit', cursor: 'pointer',
            background: active ? 'color-mix(in srgb,var(--brand) 8%,var(--surface))' : 'var(--surface)',
            borderBottom: '1px solid var(--line)', WebkitTapHighlightColor: 'transparent',
          }}>
            <_StI name={active ? 'radar' : 'storefront'} size={20}
              color={active ? '#4ade80' : 'var(--muted)'} stroke={2} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
                {s.name}{s.status === 'PROPOSED' && <span style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', marginLeft: 7 }}>Proposed</span>}
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)', marginTop: 1 }}>{s.city}, {s.state}</div>
            </div>
            {active && <span style={{ fontSize: 11.5, fontWeight: 800, color: '#4ade80',
              background: 'rgba(74,222,128,0.14)', padding: '3px 9px', borderRadius: 999 }}>Here</span>}
            <_StI name="chevR" size={16} color="var(--line-strong)" />
          </button>
        );
      })}
    </div>
  );
}

// ── Event row ──────────────────────────────────────────
function EventRow({ evt, attending, expanded, onRsvp, onExpand }) {
  const srcColor = SRC_COLOR[evt.source] || 'var(--brand)';
  const attendees = _StMM.EVENT_ATTENDEES[evt.id];
  return (
    <div style={{ borderBottom: '1px solid var(--line)', paddingTop: 10, paddingBottom: 6 }}>
      <div onClick={onExpand} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: srcColor, flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 14, fontWeight: 750, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{evt.name}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>{evt.time}</span>
        <_StI name={expanded ? 'chevU' : 'chevD'} size={14} color="var(--muted)" />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7, paddingLeft: 16, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11.5, fontWeight: 750, color: srcColor,
          background: srcColor + '14', border: `1px solid ${srcColor}44`,
          padding: '2px 8px', borderRadius: 999 }}>{evt.format}</span>
        {evt.attendeeCount > 0 && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{evt.attendeeCount} going</span>}
        {evt.hereNowCount > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11.5, fontWeight: 750,
            color: '#4ade80', background: 'rgba(74,222,128,0.12)', padding: '2px 8px', borderRadius: 999 }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: '#4ade80' }} />
            {evt.hereNowCount} here
          </span>
        )}
        <button onClick={(e) => { e.stopPropagation(); onRsvp(); }} style={{
          display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
          borderRadius: 999, border: `1.5px solid ${attending ? '#4ade80' : srcColor}`,
          background: attending ? 'rgba(74,222,128,0.12)' : 'transparent',
          color: attending ? '#4ade80' : srcColor, fontFamily: 'inherit',
          fontSize: 12, fontWeight: 800, cursor: 'pointer',
        }}>
          {attending ? '✓ Going!' : 'Going?'}
        </button>
      </div>
      {expanded && attendees && (
        <div style={{ paddingLeft: 16, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {attendees.hereNow.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--muted)', marginTop: 4 }}>Here now</div>
              {attendees.hereNow.map(p => <AttendeeRow key={p.id} player={p} hereNow />)}
            </>
          )}
          {attendees.rsvpd.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--muted)', marginTop: 6 }}>RSVP&rsquo;d</div>
              {attendees.rsvpd.map(p => <AttendeeRow key={p.id} player={p} />)}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function AttendeeRow({ player, hereNow }) {
  const fill = _Stmg(player.colors);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
      <div style={{ width: 22, height: 22, borderRadius: 6, background: fill, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 800, color: '#fff' }}>{player.name[0]}</div>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{player.name}</span>
      {hereNow && <span style={{ fontSize: 11, fontWeight: 800, color: '#4ade80',
        background: 'rgba(74,222,128,0.12)', padding: '2px 7px', borderRadius: 999 }}>Here</span>}
    </div>
  );
}

// ── Store detail sheet ─────────────────────────────────
function StoreDetailSheet({ store, checkedInId, onCheckin, checkinState, onClose, rsvpSet, onRsvp, expandedEvts, onExpandEvt, onConfirm, confirmedIds }) {
  const [tab, setTab] = useState('schedule');
  const [rewardStep, setRewardStep] = useState(null); // null | 'offer' | 'code' | 'redeemed'
  const [eventTagOpen, setEventTagOpen] = useState(false);
  const isCheckedIn = store && store.id === checkedInId;
  const isProposed = store && store.status === 'PROPOSED';
  const schedule = store ? (_StMM.STORE_SCHEDULE[store.id] || []) : [];
  const leaderboard = store ? (_StMM.STORE_LEADERBOARD[store.id] || []) : [];
  const offers = store ? (_StMM.STORE_OFFERS[store.id] || []) : [];
  const hereNow = isCheckedIn ? _StMM.PLAYERS.slice(0, 3) : [];
  const alreadyConfirmed = store && confirmedIds.has(store.id);
  const confirmCount = store ? (store.confirmCount || 0) + (alreadyConfirmed ? 1 : 0) : 0;
  const accent = storeAccent(store);

  // After check-in success: show event tag then reward
  useEffect(() => {
    if (checkinState === 'success') {
      const hasTodayEvts = schedule.some(d => d.date === 'Today' && d.events.length > 0);
      if (hasTodayEvts) setEventTagOpen(true);
      else setRewardStep('offer');
    }
  }, [checkinState]);

  return (
    <>
      {/* Backdrop */}
      {store && <div onClick={onClose} style={{ position: 'absolute', inset: 0, zIndex: 49, background: 'transparent' }} />}

      {/* Sheet */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 50,
        background: 'var(--bg)', borderRadius: '26px 26px 0 0',
        maxHeight: '88%', display: 'flex', flexDirection: 'column',
        transform: store ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform .3s cubic-bezier(.4,0,.2,1)',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
      }}>
        {/* Handle */}
        <div style={{ width: 36, height: 4, borderRadius: 999, background: 'var(--line-strong)',
          alignSelf: 'center', margin: '12px 0 4px', flexShrink: 0 }} />
        <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 16, width: 32, height: 32,
          borderRadius: 999, background: 'var(--chip-bg)', border: 'none', cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center' }}>
          <_StI name="x" size={16} color="var(--muted)" />
        </button>

        {store && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 18px 32px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, paddingRight: 30 }}>
              <_StI name="storefront" size={20} color={isProposed ? '#9CA3AF' : 'var(--brand-ink)'} />
              <span style={{ fontSize: 20, fontWeight: 850, color: 'var(--ink)', letterSpacing: '-0.02em', flex: 1, lineHeight: 1.2 }}>{store.name}</span>
              {isProposed && <span style={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF',
                border: '1px solid #9CA3AF55', padding: '2px 8px', borderRadius: 999, flexShrink: 0 }}>Proposed</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: store.discord ? 8 : 14 }}>
              <_StI name="pin" size={14} color="var(--muted)" />
              <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>{store.address} · {store.city}, {store.state}</span>
            </div>
            {store.discord && (
              <button style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px',
                background: '#5865F218', borderRadius: 10, border: 'none', cursor: 'pointer', marginBottom: 14 }}>
                <_StI name="discord" size={15} color="#5865F2" />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#5865F2' }}>Join Discord community</span>
                <_StI name="chevR" size={13} color="#5865F244" />
              </button>
            )}

            {/* Proposed confirmation widget */}
            {isProposed && (
              <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-md)', border: '1px solid var(--line)',
                padding: 14, marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <_StI name="users" size={15} color="var(--muted)" />
                  <span style={{ fontSize: 14, fontWeight: 750, color: 'var(--ink)' }}>{confirmCount}/3 confirmations</span>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: 'var(--chip-bg)', overflow: 'hidden', marginBottom: 7 }}>
                  <div style={{ height: '100%', borderRadius: 999, background: 'var(--brand)',
                    width: `${Math.min(100, (confirmCount / 3) * 100)}%`, transition: 'width .4s ease' }} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
                  3 players confirming it will make it live on the map
                </div>
                {alreadyConfirmed ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#4ade80', fontSize: 13, fontWeight: 750 }}>
                    <_StI name="check" size={15} color="#4ade80" stroke={2.5} /> You confirmed this store
                  </div>
                ) : (
                  <button onClick={() => onConfirm(store.id)} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%',
                    padding: '11px', background: 'var(--brand)', color: 'var(--on-brand)',
                    border: 'none', borderRadius: 'var(--r-md)', cursor: 'pointer', fontFamily: 'inherit',
                    fontSize: 14, fontWeight: 800,
                  }}>
                    <_StI name="check" size={16} color="var(--on-brand)" stroke={2.5} /> Confirm this is real
                  </button>
                )}
              </div>
            )}

            {/* Offers */}
            {!isProposed && offers.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase',
                  color: 'var(--muted)', marginBottom: 8 }}>Promotions</div>
                {offers.map(o => (
                  <div key={o.id} style={{ display: 'flex', gap: 10, background: 'var(--brand-soft)',
                    borderRadius: 12, padding: '10px 12px', marginBottom: 7, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 20 }}>{o.type === 'FIRST_VISIT' ? '🎁' : '🔥'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--ink)' }}>{o.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, lineHeight: 1.45 }}>{o.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Active badge */}
            {isCheckedIn && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 750,
                color: '#4ade80', background: 'rgba(74,222,128,0.12)', borderRadius: 10,
                padding: '8px 12px', marginBottom: 14, alignSelf: 'flex-start' }}>
                <span style={{ width: 7, height: 7, borderRadius: 999, background: '#4ade80',
                  boxShadow: '0 0 7px rgba(74,222,128,0.8)' }} />
                You&rsquo;re checked in here
              </div>
            )}

            {/* Schedule / Leaderboard tabs */}
            {!isProposed && (
              <>
                <div style={{ display: 'flex', background: 'var(--chip-bg)', borderRadius: 11,
                  padding: 3, marginBottom: 14 }}>
                  {['schedule', 'leaderboard'].map(t => (
                    <button key={t} onClick={() => setTab(t)} style={{
                      flex: 1, padding: '7px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      fontSize: 13, fontWeight: 800, borderRadius: 9, letterSpacing: '-0.01em',
                      background: tab === t ? 'var(--surface)' : 'transparent',
                      color: tab === t ? 'var(--ink)' : 'var(--muted)',
                      boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                      transition: 'all .18s ease',
                    }}>{t === 'schedule' ? 'Schedule' : 'Leaderboard'}</button>
                  ))}
                </div>

                {tab === 'schedule' && (
                  schedule.length === 0
                    ? <div style={{ fontSize: 13.5, color: 'var(--muted)', textAlign: 'center', padding: '20px 0' }}>No upcoming events</div>
                    : schedule.map(day => (
                      <div key={day.date}>
                        <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--muted)', letterSpacing: '-0.01em', marginTop: 6, marginBottom: 2 }}>{day.date}</div>
                        {day.events.map(evt => (
                          <EventRow key={evt.id} evt={evt}
                            attending={rsvpSet.has(evt.id)}
                            expanded={expandedEvts.has(evt.id)}
                            onRsvp={() => onRsvp(evt.id)}
                            onExpand={() => onExpandEvt(evt.id)} />
                        ))}
                      </div>
                    ))
                )}

                {tab === 'leaderboard' && (
                  leaderboard.length === 0
                    ? <div style={{ fontSize: 13.5, color: 'var(--muted)', textAlign: 'center', padding: '20px 0' }}>No check-ins yet — be the first!</div>
                    : leaderboard.map(row => (
                      <div key={row.rank} style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px',
                        borderRadius: 11, marginBottom: 4,
                        background: row.isMe ? 'var(--brand-soft)' : 'transparent',
                      }}>
                        <span style={{ width: 24, fontSize: 13, fontWeight: 800,
                          color: row.rank <= 3 ? 'var(--brand-ink)' : 'var(--muted)', textAlign: 'center' }}>
                          {row.rank <= 3 ? ['🥇','🥈','🥉'][row.rank-1] : `#${row.rank}`}
                        </span>
                        <div style={{ width: 30, height: 30, borderRadius: 9,
                          background: _Stmg(row.colors), display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 13, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{row.name[0]}</div>
                        <span style={{ flex: 1, fontSize: 14, fontWeight: row.isMe ? 800 : 700, color: 'var(--ink)' }}>{row.name}</span>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)' }}>🔥 {row.streak}w</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{row.total} visits</div>
                        </div>
                      </div>
                    ))
                )}

                {/* Who's here now */}
                {isCheckedIn && hereNow.length > 0 && (
                  <>
                    <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase',
                      color: 'var(--muted)', margin: '14px 0 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 7, height: 7, borderRadius: 999, background: '#4ade80',
                        boxShadow: '0 0 5px rgba(74,222,128,0.8)' }} />
                      Here now ({hereNow.length})
                    </div>
                    <div style={{ background: 'var(--surface)', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--line)' }}>
                      {hereNow.map((p, i) => (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                          borderTop: i > 0 ? '1px solid var(--line)' : 'none' }}>
                          <_StAv player={p} size={34} ring={2} />
                          <span style={{ flex: 1, fontSize: 14, fontWeight: 750, color: 'var(--ink)' }}>{p.name}</span>
                          {p.metBefore && <span style={{ fontSize: 11.5, fontWeight: 750, color: 'var(--brand-ink)',
                            background: 'var(--brand-soft)', padding: '2px 8px', borderRadius: 999 }}>Met</span>}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}

            {/* Check-in button */}
            {!isProposed && (
              <div style={{ marginTop: 16 }}>
                {checkinState === 'success' && isCheckedIn ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    height: 52, color: '#4ade80', fontSize: 15, fontWeight: 750 }}>
                    <_StI name="check" size={20} color="#4ade80" stroke={2.5} /> Checked in! Discover is now active.
                  </div>
                ) : checkinState === 'tooFar' ? (
                  <div style={{ background: 'var(--brand-soft)', border: '1px solid var(--brand)40',
                    borderRadius: 14, padding: 14 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)', marginBottom: 5 }}>You&rsquo;re too far away</div>
                    <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 10 }}>
                      You&rsquo;re ~680m from {store.name}. Get within 250m to check in.
                    </div>
                    <button onClick={() => onCheckin(store.id)} style={{
                      padding: '8px 18px', background: 'var(--brand)', color: 'var(--on-brand)',
                      border: 'none', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
                      fontSize: 13, fontWeight: 800,
                    }}>Try again</button>
                  </div>
                ) : checkinState === 'denied' ? (
                  <div style={{ background: 'rgba(255,180,50,0.12)', border: '1px solid rgba(255,180,50,0.3)',
                    borderRadius: 14, padding: 14 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 750, color: 'var(--ink)', lineHeight: 1.5 }}>
                      Location access is needed to verify you&rsquo;re at the store.
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--brand-ink)', fontWeight: 750, marginTop: 8 }}>Open Settings →</div>
                  </div>
                ) : (
                  <button onClick={() => onCheckin(store.id)} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    width: '100%', height: 52, background: isCheckedIn ? 'var(--muted)' : 'var(--brand)',
                    color: 'var(--on-brand)', border: 'none', borderRadius: 'var(--r-lg)',
                    cursor: isCheckedIn ? 'default' : 'pointer', fontFamily: 'inherit',
                    fontSize: 15, fontWeight: 800, letterSpacing: '-0.01em',
                    boxShadow: isCheckedIn ? 'none' : '0 6px 20px var(--brand-shadow)',
                    transition: 'all .2s ease',
                  }}>
                    <_StI name={checkinState === 'acquiring' ? 'clock' : isCheckedIn ? 'check' : 'radar'}
                      size={20} color="var(--on-brand)" />
                    {checkinState === 'acquiring' ? 'Getting your location…' : isCheckedIn ? 'Already here' : 'Check in here'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Event tag modal */}
      {eventTagOpen && store && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center',
          justifyContent: 'center', padding: 20, background: 'rgba(0,0,0,0.5)' }}>
          <div style={{ background: 'var(--surface)', borderRadius: 22, padding: '22px 20px', width: '100%' }}>
            <div style={{ fontSize: 19, fontWeight: 850, color: 'var(--ink)', marginBottom: 14, letterSpacing: '-0.02em' }}>Here for an event?</div>
            {((_StMM.STORE_SCHEDULE[store.id] || [])[0]?.events || []).map(evt => (
              <button key={evt.id} onClick={() => { setEventTagOpen(false); setRewardStep('offer'); }} style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 14px',
                background: 'var(--brand-soft)', border: '1px solid var(--brand)30', borderRadius: 14,
                cursor: 'pointer', fontFamily: 'inherit', marginBottom: 8, textAlign: 'left',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>{evt.name}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{evt.time} · {evt.format}</div>
                </div>
                <_StI name="chevR" size={16} color="var(--brand-ink)" />
              </button>
            ))}
            <button onClick={() => { setEventTagOpen(false); setRewardStep('offer'); }} style={{
              width: '100%', padding: '10px', background: 'none', border: 'none',
              cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: 'var(--muted)',
            }}>Just visiting</button>
          </div>
        </div>
      )}

      {/* Reward modal */}
      {rewardStep === 'offer' && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center',
          justifyContent: 'center', padding: 20, background: 'rgba(0,0,0,0.5)' }}>
          <div style={{ background: 'var(--surface)', borderRadius: 22, padding: '24px 20px', width: '100%' }}>
            <div style={{ textAlign: 'center', marginBottom: 18 }}>
              <div style={{
                width: 64, height: 64, margin: '0 auto 10px', borderRadius: '50%',
                background: `${accent}26`, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <_StI name="gift" size={32} color={accent} />
              </div>
              <div style={{ fontSize: 20, fontWeight: 850, color: accent, letterSpacing: '-0.02em' }}>You unlocked a reward!</div>
            </div>
            <div style={{ background: 'var(--brand-soft)', borderRadius: 14, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>First visit bonus</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>10% off singles or sealed. Show staff your badge to redeem.</div>
            </div>
            <button onClick={() => setRewardStep('code')} style={{
              width: '100%', height: 50, background: accent, color: _StRdOn(accent),
              border: 'none', borderRadius: 'var(--r-lg)', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 15, fontWeight: 800, marginBottom: 10,
            }}>Redeem at counter</button>
            <button onClick={() => setRewardStep(null)} style={{
              width: '100%', padding: '10px', background: 'none', border: 'none',
              cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: 'var(--muted)',
            }}>Not now</button>
          </div>
        </div>
      )}

      {/* Claim code */}
      {rewardStep === 'code' && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center',
          justifyContent: 'center', padding: 20, background: 'rgba(0,0,0,0.5)' }}>
          <div style={{ background: 'var(--surface)', borderRadius: 22, padding: '24px 20px', width: '100%', textAlign: 'center' }}>
            <div style={{ marginBottom: 8 }}><_StI name="gift" size={26} color={accent} /></div>
            <div style={{
              fontSize: 13, fontWeight: 700, color: accent, marginBottom: 4,
              letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>Show staff this code</div>
            <div style={{ fontSize: 20, fontWeight: 850, color: 'var(--ink)', marginBottom: 18, letterSpacing: '-0.02em' }}>First visit bonus</div>
            <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: 5, color: accent, marginBottom: 16 }}>MM-7X4Q</div>
            <div style={{
              display: 'inline-flex', justifyContent: 'center', marginBottom: 14,
              border: `2px solid ${accent}`, borderRadius: 16, padding: 4,
            }}>
              <FakeQR code="MM-7X4Q" size={140} />
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 18 }}>Staff will scan or enter this code</div>
            <button onClick={() => setRewardStep(null)} style={{
              width: '100%', height: 48, background: accent, color: _StRdOn(accent),
              border: 'none', borderRadius: 'var(--r-lg)', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 15, fontWeight: 800,
            }}>Done</button>
          </div>
        </div>
      )}
    </>
  );
}

// ── StoresScreen ───────────────────────────────────────
function StoresScreen({ onClose, initialStoreId = null }) {
  const [viewMode, setViewMode] = useState('map');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(initialStoreId);
  const [checkedInId, setCheckedInId] = useState('s1'); // Dragon's Den = user's home store
  const [checkinState, setCheckinState] = useState('idle');
  const [rsvpSet, setRsvpSet] = useState(new Set(['se1']));
  const [expandedEvts, setExpandedEvts] = useState(new Set());
  const [confirmedIds, setConfirmedIds] = useState(new Set());

  const stores = _StMM.STORES || [];
  const selectedStore = stores.find(s => s.id === selectedId) || null;

  function handleCheckin(storeId) {
    if (storeId === checkedInId) return;
    setCheckinState('acquiring');
    setTimeout(() => {
      setCheckinState('success');
      setCheckedInId(storeId);
    }, 1400);
  }
  function toggleRsvp(evtId) {
    setRsvpSet(prev => { const n = new Set(prev); n.has(evtId) ? n.delete(evtId) : n.add(evtId); return n; });
  }
  function toggleExpand(evtId) {
    setExpandedEvts(prev => { const n = new Set(prev); n.has(evtId) ? n.delete(evtId) : n.add(evtId); return n; });
  }
  function handleConfirm(storeId) {
    setConfirmedIds(prev => new Set([...prev, storeId]));
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', position: 'relative', paddingTop: 54 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px 10px',
        borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
        <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 999, background: 'var(--chip-bg)',
          border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <_StI name="chevL" size={20} color="var(--ink-2)" stroke={2.5} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 850, color: 'var(--ink)', letterSpacing: '-0.025em', lineHeight: 1.1 }}>Stores</div>
          {checkedInId && <div style={{ fontSize: 11.5, fontWeight: 750, color: '#4ade80', marginTop: 1 }}>
            Active: {stores.find(s => s.id === checkedInId)?.name}</div>}
        </div>
        {/* Map / List toggle */}
        <div style={{ display: 'flex', background: 'var(--chip-bg)', borderRadius: 10, padding: 3 }}>
          {[['map', 'map'], ['list', 'list']].map(([mode, icon]) => (
            <button key={mode} onClick={() => setViewMode(mode)} style={{
              width: 34, height: 34, borderRadius: 8, border: 'none', cursor: 'pointer',
              background: viewMode === mode ? 'var(--surface)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: viewMode === mode ? '0 1px 4px rgba(0,0,0,0.1)' : 'none', transition: 'all .15s ease',
            }}>
              <_StI name={icon} size={17} color={viewMode === mode ? 'var(--brand-ink)' : 'var(--muted)'} />
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 14px 8px',
        background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: '0 12px', flexShrink: 0 }}>
        <_StI name="radar" size={16} color="var(--muted)" />
        <input value={query} onChange={e => { setQuery(e.target.value); if (viewMode === 'map' && e.target.value) setViewMode('list'); }}
          placeholder="Search stores by name or city…"
          style={{ flex: 1, border: 'none', background: 'none', outline: 'none', height: 42,
            fontSize: 14.5, fontWeight: 600, color: 'var(--ink)', fontFamily: 'inherit' }} />
        {query && <button onClick={() => setQuery('')} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4, color: 'var(--muted)' }}>✕</button>}
      </div>

      {/* Map or List */}
      {viewMode === 'map'
        ? <PseudoMap stores={stores} checkedInId={checkedInId} selectedId={selectedId} onSelect={setSelectedId} />
        : <StoreListView stores={stores} query={query} checkedInId={checkedInId} onSelect={id => { setSelectedId(id); }} />
      }

      {/* Detail sheet */}
      <StoreDetailSheet
        store={selectedStore}
        checkedInId={checkedInId}
        onCheckin={handleCheckin}
        checkinState={checkinState}
        onClose={() => { setSelectedId(null); setCheckinState('idle'); }}
        rsvpSet={rsvpSet}
        onRsvp={toggleRsvp}
        expandedEvts={expandedEvts}
        onExpandEvt={toggleExpand}
        onConfirm={handleConfirm}
        confirmedIds={confirmedIds}
      />
    </div>
  );
}

Object.assign(window, { StoresScreen });
