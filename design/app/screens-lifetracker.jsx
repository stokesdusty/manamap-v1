// manamap — Life Tracker (M37). Exports LifeTrackerScreen.
const { useState, useRef, useCallback } = React;
const { manaGradient: _LTmg, manaAccent: _LTma, Icon: _LTI } = window;
const _LTMM = window.MM;

const POOL = [
  { id: 'me', name: _LTMM.ME.name, colors: _LTMM.ME.colors },
  { id: 'p1', name: 'Wrenfield',   colors: ['U','B'] },
  { id: 'p2', name: 'Sol Ringer',  colors: ['R','W'] },
  { id: 'p3', name: 'Mossbrook',   colors: ['G']     },
];

function mkPlayers(count, life) {
  return POOL.slice(0, count).map(p => ({
    ...p, life, poison: 0, energy: 0, experience: 0,
    commanderDamage: {}, isEliminated: false, commanderCastCount: 0,
  }));
}

// ── RepeatButton (long-press repeats) ─────────────────────
function RepeatButton({ onDelta, label, style }) {
  const tRef = useRef(null), iRef = useRef(null);
  const stop = () => { clearTimeout(tRef.current); clearInterval(iRef.current); };
  const start = () => {
    onDelta();
    tRef.current = setTimeout(() => { iRef.current = setInterval(onDelta, 120); }, 450);
  };
  return (
    <button onPointerDown={start} onPointerUp={stop} onPointerLeave={stop}
      style={{ flex: 1, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        background: 'var(--chip-bg)', borderRadius: 8, minHeight: 36,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, fontWeight: 800, color: 'var(--ink-2)', ...style }}>
      {label}
    </button>
  );
}

// ── CommanderDamageSheet ──────────────────────────────────
function CommanderDamageSheet({ target, allPlayers, onDelta, onClose }) {
  const sources = allPlayers.filter(p => p.id !== target.id);
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 80 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0,
        background: 'var(--bg)', borderRadius: '24px 24px 0 0', padding: '16px 18px 36px',
        boxShadow: '0 -8px 32px rgba(0,0,0,0.25)' }}>
        <div style={{ width: 36, height: 4, borderRadius: 999, background: 'var(--line-strong)',
          margin: '0 auto 14px', }} />
        <div style={{ fontSize: 16, fontWeight: 850, color: 'var(--ink)', letterSpacing: '-0.015em', marginBottom: 14 }}>
          Commander Damage → {target.name}
        </div>
        {sources.map(src => {
          const dmg = target.commanderDamage[src.id] || 0;
          const danger = dmg >= 18;
          return (
            <div key={src.id} style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 13,
              borderBottom: '1px solid var(--line)', marginBottom: 13 }}>
              <div style={{ width: 10, height: 10, borderRadius: 999, background: _LTmg(src.colors), flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 14, fontWeight: 750, color: 'var(--ink)' }}>{src.name}</span>
              <span style={{ fontSize: 22, fontWeight: 900, color: danger ? '#ef4444' : 'var(--ink)',
                minWidth: 36, textAlign: 'center' }}>{dmg}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {[-1, 1].map(d => (
                  <button key={d} onClick={() => onDelta(src.id, d)} style={{
                    width: 38, height: 38, borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: d > 0 ? 'var(--brand)' : 'var(--chip-bg)',
                    color: d > 0 ? 'var(--on-brand)' : 'var(--ink-2)',
                    fontSize: 20, fontWeight: 800, fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{d > 0 ? '+' : '−'}</button>
                ))}
              </div>
            </div>
          );
        })}
        <button onClick={onClose} style={{ width: '100%', height: 48, background: 'var(--brand)',
          color: 'var(--on-brand)', border: 'none', borderRadius: 'var(--r-lg)', cursor: 'pointer',
          fontFamily: 'inherit', fontSize: 15, fontWeight: 800, marginTop: 4 }}>Done</button>
      </div>
    </div>
  );
}

// ── PlayerPanel ───────────────────────────────────────────
function PlayerPanel({ player, allPlayers, isFlipped, compact, isActive, onLifeDelta, onCounterDelta, onCommanderDamage, onEliminate, onCmdOpen }) {
  const accent = _LTma(player.colors);
  const cmdTotal = Object.values(player.commanderDamage).reduce((a, b) => a + b, 0);
  const lifeFontSize = compact ? 58 : 82;
  const COUNTERS = [
    { key: 'poison', icon: '☠', danger: player.poison >= 8 },
    { key: 'energy', icon: '⚡' },
    { key: 'experience', icon: '✦' },
  ];
  const visibleCounters = COUNTERS.filter(c => !compact || c.key === 'poison' || player[c.key] > 0);

  const panel = (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', margin: 2,
      border: `${isActive ? 2.5 : 1.5}px solid ${isActive ? accent : accent + '55'}`,
      borderRadius: 12, background: 'var(--surface)',
      opacity: player.isEliminated ? 0.55 : 1, position: 'relative', overflow: 'hidden',
      padding: compact ? '6px 6px 4px' : '8px 8px 6px',
    }}>
      {/* Eliminated overlay */}
      {player.isEliminated && (
        <div style={{ position: 'absolute', inset: 0, background: '#ef444414', pointerEvents: 'none', borderRadius: 10 }} />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
        <div style={{ width: 9, height: 9, borderRadius: 999, background: _LTmg(player.colors), flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: compact ? 11 : 13, fontWeight: 800, color: 'var(--ink)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {player.name}{player.commanderCastCount > 0 && <span style={{ fontWeight: 600, color: 'var(--muted)' }}> ×{player.commanderCastCount + 1}</span>}
        </span>
        <button onClick={onEliminate} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 2, color: 'var(--muted)' }}>
          <_LTI name={player.isEliminated ? 'check' : 'x'} size={compact ? 15 : 18} color={player.isEliminated ? '#4ade80' : 'var(--muted)'} stroke={2.2} />
        </button>
      </div>

      {/* Life */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <div style={{ fontSize: lifeFontSize, fontWeight: 900, color: player.isEliminated ? 'var(--muted)' : 'var(--ink)',
          lineHeight: 1, letterSpacing: '-0.03em' }}>
          {player.life}
          {player.isEliminated && <div style={{ fontSize: 11, fontWeight: 800, color: '#ef4444', letterSpacing: 2, textAlign: 'center' }}>OUT</div>}
        </div>
        {/* ±1 / ±5 buttons */}
        <div style={{ display: 'flex', gap: 4, alignSelf: 'stretch' }}>
          <RepeatButton onDelta={() => onLifeDelta(-5)} label="-5" />
          <RepeatButton onDelta={() => onLifeDelta(-1)} label="−" />
          <RepeatButton onDelta={() => onLifeDelta(1)}  label="+" />
          <RepeatButton onDelta={() => onLifeDelta(5)}  label="+5" />
        </div>
      </div>

      {/* Counter row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: compact ? 6 : 10, marginTop: 4 }}>
        {visibleCounters.map(c => (
          <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <button onClick={() => onCounterDelta(c.key, -1)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: compact ? 11 : 13, color: 'var(--muted)', padding: '2px 3px', fontFamily: 'inherit' }}>−</button>
            <span style={{ fontSize: compact ? 12 : 14, color: c.danger ? '#ef4444' : 'var(--ink-2)', fontWeight: 700 }}>{c.icon} {player[c.key]}</span>
            <button onClick={() => onCounterDelta(c.key, 1)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: compact ? 11 : 13, color: 'var(--brand-ink)', padding: '2px 3px', fontFamily: 'inherit' }}>+</button>
          </div>
        ))}
        {/* CMD button */}
        <button onClick={onCmdOpen} style={{ border: '1px solid var(--line)', background: 'none', cursor: 'pointer',
          fontFamily: 'inherit', fontSize: compact ? 10 : 11, fontWeight: 750, color: cmdTotal > 0 ? '#ef4444' : 'var(--muted)',
          padding: '2px 6px', borderRadius: 5 }}>
          CMD {cmdTotal || '+'}
        </button>
      </div>
    </div>
  );

  return isFlipped
    ? <div style={{ flex: 1, transform: 'rotate(180deg)', display: 'flex' }}>{panel}</div>
    : <div style={{ flex: 1, display: 'flex' }}>{panel}</div>;
}

// ── SetupSheet ─────────────────────────────────────────────
function SetupSheet({ onStart, onClose }) {
  const [count, setCount] = useState(4);
  const [life, setLife] = useState(40);
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: 24, background: 'var(--bg)', gap: 20 }}>
      <div style={{ width: '100%', background: 'var(--surface)', borderRadius: 22,
        padding: '22px 20px', boxShadow: 'var(--shadow-card)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ fontSize: 20, fontWeight: 850, color: 'var(--ink)', letterSpacing: '-0.02em' }}>Start Life Tracker</div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}>
            <_LTI name="x" size={20} color="var(--muted)" />
          </button>
        </div>

        {/* Player count */}
        <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', marginBottom: 8 }}>Players</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[2, 3, 4].map(n => (
            <button key={n} onClick={() => setCount(n)} style={{
              flex: 1, height: 44, border: `1.5px solid ${count === n ? 'var(--brand)' : 'var(--line)'}`,
              background: count === n ? 'var(--brand-soft)' : 'var(--surface)', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 17, fontWeight: 800, borderRadius: 12,
              color: count === n ? 'var(--brand-ink)' : 'var(--ink-2)',
            }}>{n}</button>
          ))}
        </div>

        {/* Starting life */}
        <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', marginBottom: 8 }}>Starting life</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
          {[20, 40].map(n => (
            <button key={n} onClick={() => setLife(n)} style={{
              flex: 1, height: 44, border: `1.5px solid ${life === n ? 'var(--brand)' : 'var(--line)'}`,
              background: life === n ? 'var(--brand-soft)' : 'var(--surface)', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 17, fontWeight: 800, borderRadius: 12,
              color: life === n ? 'var(--brand-ink)' : 'var(--ink-2)',
            }}>{n}</button>
          ))}
        </div>

        <button onClick={() => onStart(count, life)} style={{
          width: '100%', height: 52, background: 'var(--brand)', color: 'var(--on-brand)',
          border: 'none', borderRadius: 'var(--r-lg)', cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 16, fontWeight: 800, boxShadow: '0 6px 20px var(--brand-shadow)',
        }}>Start — {life} life</button>
      </div>
    </div>
  );
}

// ── GameBar ────────────────────────────────────────────────
function GameBar({ turn, players, activeIdx, canUndo, onUndo, onNextTurn, onReset, onClose }) {
  const active = players[activeIdx];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 54, paddingBottom: 8,
      paddingLeft: 10, paddingRight: 10, background: 'var(--bg)',
      borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
      <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 999, border: 'none',
        background: 'var(--chip-bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <_LTI name="x" size={18} color="var(--ink-2)" />
      </button>

      {/* Turn chip */}
      <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--muted)',
        background: 'var(--chip-bg)', padding: '5px 10px', borderRadius: 999 }}>T{turn}</span>

      {/* Active player */}
      {active && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 800,
          color: _LTma(active.colors), background: _LTma(active.colors) + '18',
          padding: '5px 10px', borderRadius: 999, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <span style={{ width: 7, height: 7, borderRadius: 999, background: _LTma(active.colors), flexShrink: 0 }} />
          {active.name}
        </span>
      )}

      <div style={{ flex: 1 }} />

      {/* Controls */}
      <button onClick={onUndo} disabled={!canUndo} style={{ width: 34, height: 34, borderRadius: 999, border: 'none',
        background: 'none', cursor: canUndo ? 'pointer' : 'default', opacity: canUndo ? 1 : 0.3,
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <_LTI name="swap" size={19} color="var(--ink-2)" stroke={2} />
      </button>
      <button onClick={onNextTurn} style={{ width: 34, height: 34, borderRadius: 999, border: 'none',
        background: 'var(--brand-soft)', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <_LTI name="arrowR" size={18} color="var(--brand-ink)" stroke={2.2} />
      </button>
      <button onClick={onReset} style={{ width: 34, height: 34, borderRadius: 999, border: 'none',
        background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <_LTI name="target" size={18} color="var(--muted)" stroke={1.8} />
      </button>
    </div>
  );
}

// ── LifeTrackerScreen ─────────────────────────────────────
function LifeTrackerScreen({ onClose }) {
  const [started, setStarted] = useState(false);
  const [players, setPlayers] = useState([]);
  const [startingLife, setStartingLife] = useState(40);
  const [turn, setTurn] = useState(1);
  const [activeIdx, setActiveIdx] = useState(0);
  const [history, setHistory] = useState([]);
  const [cmdSheetTarget, setCmdSheetTarget] = useState(null); // player id

  const save = (ps) => { setHistory(h => [...h.slice(-19), players]); setPlayers(ps); };
  const lifeDelta = (id, d) => save(players.map(p => p.id === id ? { ...p, life: p.life + d } : p));
  const counterDelta = (id, key, d) => save(players.map(p => p.id === id ? { ...p, [key]: Math.max(0, p[key] + d) } : p));
  const commanderDmg = (targetId, srcId, d) => save(players.map(p => p.id === targetId
    ? { ...p, commanderDamage: { ...p.commanderDamage, [srcId]: Math.max(0, (p.commanderDamage[srcId] || 0) + d) } }
    : p));
  const eliminate = (id) => save(players.map(p => p.id === id ? { ...p, isEliminated: !p.isEliminated } : p));
  const undo = () => { if (!history.length) return; setPlayers(history[history.length - 1]); setHistory(h => h.slice(0, -1)); };
  const nextTurn = () => { setTurn(t => t + 1); setActiveIdx(i => (i + 1) % players.length); };
  const reset = () => { setHistory([]); setPlayers(mkPlayers(players.length, startingLife)); setTurn(1); setActiveIdx(0); };

  function start(count, life) {
    setStartingLife(life);
    setPlayers(mkPlayers(count, life));
    setStarted(true);
  }

  const count = players.length;
  const compact = count === 4;

  const makePanel = (p, isFlipped) => (
    <PlayerPanel key={p.id} player={p} allPlayers={players} isFlipped={isFlipped} compact={compact}
      isActive={players[activeIdx]?.id === p.id}
      onLifeDelta={d => lifeDelta(p.id, d)}
      onCounterDelta={(key, d) => counterDelta(p.id, key, d)}
      onCommanderDamage={(srcId, d) => commanderDmg(p.id, srcId, d)}
      onEliminate={() => eliminate(p.id)}
      onCmdOpen={() => setCmdSheetTarget(p.id)}
    />
  );

  let grid = null;
  if (started && players.length >= 2) {
    const [me, p1, p2, p3] = players;
    if (count === 2) {
      grid = (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {makePanel(p1, true)}
          {makePanel(me, false)}
        </div>
      );
    } else if (count === 3) {
      grid = (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, display: 'flex' }}>
            {makePanel(p1, true)}
            {makePanel(p2, true)}
          </div>
          {makePanel(me, false)}
        </div>
      );
    } else {
      grid = (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, display: 'flex' }}>
            {makePanel(p1, true)}
            {makePanel(p2, true)}
          </div>
          <div style={{ flex: 1, display: 'flex' }}>
            {makePanel(p3, false)}
            {makePanel(me, false)}
          </div>
        </div>
      );
    }
  }

  const cmdTarget = cmdSheetTarget ? players.find(p => p.id === cmdSheetTarget) : null;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', position: 'relative' }}>
      {!started ? (
        <>
          {/* Minimal top bar */}
          <div style={{ paddingTop: 54, paddingLeft: 14, paddingBottom: 8, flexShrink: 0 }}>
            <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: 'var(--brand)', fontFamily: 'inherit', fontSize: 16, fontWeight: 700 }}>
              <_LTI name="chevL" size={20} color="var(--brand)" stroke={2.5} /> Back
            </button>
          </div>
          <SetupSheet onStart={start} onClose={onClose} />
        </>
      ) : (
        <>
          <GameBar turn={turn} players={players} activeIdx={activeIdx}
            canUndo={history.length > 0} onUndo={undo} onNextTurn={nextTurn} onReset={reset} onClose={onClose} />
          {grid}
        </>
      )}

      {/* Commander damage sheet */}
      {cmdTarget && (
        <CommanderDamageSheet
          target={cmdTarget}
          allPlayers={players}
          onDelta={(srcId, d) => commanderDmg(cmdTarget.id, srcId, d)}
          onClose={() => setCmdSheetTarget(null)}
        />
      )}
    </div>
  );
}

Object.assign(window, { LifeTrackerScreen });
