// manamap — Log a game. Exports gameStats, GameStatsStrip, RecentGames,
// ConfirmGamesSection, LogGameFlow. Depends on window globals.
const { Avatar: _GAv, Icon: _GI, Button: _GB, ManaRow: _GMR } = window;
const _MMg = window.MM;
const { useState: _gus } = React;

function nameOf(id, me) { return id === 'me' ? me.name : (_MMg.byId(id) ? _MMg.byId(id).name : id); }
function playerOf(id, me) { return id === 'me' ? me : _MMg.byId(id); }

// ── stats (derived from confirmed games involving me) ─────
function gameStats(games) {
  let wins = 0, losses = 0;
  const byDeck = {};
  games.forEach(g => {
    const mine = g.roster.find(r => r.id === 'me');
    if (!mine) return;
    const won = g.winnerId === 'me';
    if (won) wins++; else losses++;
    const d = byDeck[mine.deck] || (byDeck[mine.deck] = { deck: mine.deck, w: 0, l: 0 });
    if (won) d.w++; else d.l++;
  });
  const total = wins + losses;
  const decks = Object.values(byDeck).map(d => ({ ...d, games: d.w + d.l, rate: d.w + d.l ? Math.round(100 * d.w / (d.w + d.l)) : 0 }))
    .sort((a, b) => b.games - a.games);
  return { games: total, wins, losses, winRate: total ? Math.round(100 * wins / total) : 0, decks };
}

// ── profile stats strip ───────────────────────────────────
function GameStatsStrip({ stats }) {
  const cells = [
    { v: stats.games, l: 'Games' },
    { v: stats.wins, l: 'Wins' },
    { v: `${stats.winRate}%`, l: 'Win rate' },
  ];
  return (
    <div>
      <div style={{ display: 'flex', gap: 10 }}>
        {cells.map((c, i) => {
          const hero = i === 2;
          return (
            <div key={i} style={{ flex: 1, backgroundImage: hero ? 'var(--identity-grad)' : 'none', background: hero ? undefined : 'var(--surface)', border: hero ? 'none' : '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '13px 10px', textAlign: 'center', boxShadow: hero ? '0 4px 14px color-mix(in srgb, var(--brand) 34%, transparent)' : 'var(--shadow-row)' }}>
              <div style={{ fontSize: 22, fontWeight: 850, color: hero ? '#fff' : 'var(--ink)', letterSpacing: '-0.02em', textShadow: hero ? '0 1px 2px rgba(0,0,0,0.2)' : 'none' }}>{c.v}</div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: hero ? 'rgba(255,255,255,0.9)' : 'var(--muted)', marginTop: 1 }}>{c.l}</div>
            </div>
          );
        })}
      </div>
      {stats.decks.length > 0 && (
        <div style={{ marginTop: 10, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '12px 14px', boxShadow: 'var(--shadow-row)' }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 9 }}>By deck</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {stats.decks.map(d => (
              <div key={d.deck} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.deck}</span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)' }}>{d.w}–{d.l}</span>
                <span style={{ width: 64, height: 7, borderRadius: 999, background: 'var(--chip-bg)', overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', width: `${d.rate}%`, background: 'var(--brand)' }} />
                </span>
                <span style={{ width: 34, textAlign: 'right', fontSize: 12.5, fontWeight: 800, color: 'var(--brand-ink)' }}>{d.rate}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── recent games list ─────────────────────────────────────
function RecentGames({ games, me }) {
  if (!games.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {games.map(g => {
        const won = g.winnerId === 'me';
        const winner = playerOf(g.winnerId, me);
        return (
          <div key={g.id} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '12px 14px', boxShadow: 'var(--shadow-row)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.03em', textTransform: 'uppercase', color: won ? 'var(--brand-ink)' : 'var(--muted)', background: won ? 'var(--brand-soft)' : 'var(--chip-bg)', padding: '3px 9px', borderRadius: 999 }}>{won ? 'Won' : 'Loss'}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)' }}>{g.format}</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>{g.when}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 10 }}>
              <span style={{ display: 'flex' }}>
                {g.roster.slice(0, 4).map((r, i) => (
                  <span key={r.id} style={{ marginLeft: i ? -8 : 0, borderRadius: '32%', outline: '2px solid var(--surface)' }}><_GAv player={playerOf(r.id, me)} size={28} ring={0} /></span>
                ))}
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)', marginLeft: 4 }}>
                {won ? 'You won' : `${winner.name} won`} · {g.store}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── confirm section (Connect tab) ─────────────────────────
function ConfirmGamesSection({ pending, me, onConfirm, onDispute }) {
  if (!pending.length) return null;
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px 9px' }}>
        <span style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--muted)' }}>Confirm results</span>
        <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--brand-ink)', background: 'var(--brand-soft)', padding: '1px 8px', borderRadius: 999 }}>{pending.length}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        {pending.map(g => {
          const by = playerOf(g.loggedById, me);
          const winner = playerOf(g.winnerId, me);
          const iWon = g.winnerId === 'me';
          return (
            <div key={g.id} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', padding: 14, boxShadow: 'var(--shadow-card)' }}>
              <div style={{ fontSize: 14.5, fontWeight: 750, color: 'var(--ink)', lineHeight: 1.4 }}>
                {by.name} logged a {g.format} game — <span style={{ color: 'var(--brand-ink)' }}>{iWon ? 'you won' : `${winner.name} won`}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 9 }}>
                <span style={{ display: 'flex' }}>
                  {g.roster.map((r, i) => (
                    <span key={r.id} style={{ marginLeft: i ? -8 : 0, borderRadius: '32%', outline: '2px solid var(--surface)' }}><_GAv player={playerOf(r.id, me)} size={28} ring={0} /></span>
                  ))}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginLeft: 4 }}>{g.when} · {g.store}</span>
              </div>
              <div style={{ display: 'flex', gap: 9, marginTop: 13 }}>
                <_GB variant="ghost" size="sm" full onClick={() => onDispute(g)}>Dispute</_GB>
                <_GB variant="primary" size="sm" full icon="check" onClick={() => onConfirm(g)}>Confirm</_GB>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Log a game flow (sheet, stepped) ──────────────────────
function LogGameFlow({ pod, me, connections, onSubmit, onClose }) {
  // roster of player ids (me always included). If from a pod, prefill.
  const podIds = pod ? pod.filledIds.map(id => (id === 'me' ? 'me' : id)) : ['me'];
  const [step, setStep] = _gus(0);
  const [roster, setRoster] = _gus(podIds);
  const [decks, setDecks] = _gus(() => {
    const d = {}; d['me'] = me.commander || ''; return d;
  });
  const [winner, setWinner] = _gus(null);

  const connPlayers = (connections || []).map(c => _MMg.byId(c.playerId)).filter(Boolean);

  const toggle = (id) => setRoster(r => r.includes(id) ? r.filter(x => x !== id) : [...r, id]);
  const setDeck = (id, v) => setDecks(d => ({ ...d, [id]: v }));

  const STEPS = pod ? ['decks', 'winner', 'confirm'] : ['players', 'decks', 'winner', 'confirm'];
  const cur = STEPS[step];
  const canNext = (
    cur === 'players' ? roster.length >= 2 :
    cur === 'decks' ? roster.every(id => (decks[id] || '').trim() || id !== 'me') : // only my deck required
    cur === 'winner' ? winner != null : true
  );

  const submit = () => onSubmit({
    format: pod ? pod.format : 'Commander',
    store: 'Dragon\u2019s Den',
    roster: roster.map(id => ({ id, deck: (decks[id] || '').trim() })),
    winnerId: winner,
  });

  return (
    <div style={{ padding: '6px 20px 28px' }}>
      <div style={{ width: 40, height: 5, borderRadius: 999, background: 'var(--line-strong)', margin: '0 auto 16px' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        {step > 0 && <button onClick={() => setStep(step - 1)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--brand)', padding: 0, display: 'flex' }}><_GI name="chevL" size={22} stroke={2.6} /></button>}
        <div style={{ fontSize: 22, fontWeight: 850, letterSpacing: '-0.025em', color: 'var(--ink)' }}>
          {cur === 'players' ? 'Who played?' : cur === 'decks' ? 'What did everyone run?' : cur === 'winner' ? 'Who won?' : 'Log this game'}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, margin: '8px 0 20px' }}>
        {STEPS.map((s, i) => <span key={s} style={{ height: 4, flex: 1, borderRadius: 999, background: i <= step ? 'var(--brand)' : 'var(--line-strong)' }} />)}
      </div>

      {cur === 'players' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <_GRosterRow player={me} on locked label="You" />
          {connPlayers.map(p => (
            <_GRosterRow key={p.id} player={p} on={roster.includes(p.id)} onToggle={() => toggle(p.id)} />
          ))}
        </div>
      )}

      {cur === 'decks' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {roster.map(id => {
            const p = playerOf(id, me);
            return (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <_GAv player={p} size={38} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>{id === 'me' ? 'You' : p.name}</div>
                  <input value={decks[id] || ''} onChange={e => setDeck(id, e.target.value)} placeholder={id === 'me' ? 'Your commander' : 'Their commander (optional)'} style={_gInput} onFocus={e => e.target.style.borderColor = 'var(--brand)'} onBlur={e => e.target.style.borderColor = 'var(--line)'} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {cur === 'winner' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {roster.map(id => {
            const p = playerOf(id, me); const on = winner === id;
            return (
              <button key={id} onClick={() => setWinner(id)} style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                background: on ? 'var(--brand-soft)' : 'var(--surface)', border: on ? '1.5px solid var(--brand)' : '1.5px solid var(--line)',
                borderRadius: 'var(--r-md)', padding: 12,
              }}>
                <_GAv player={p} size={40} />
                <span style={{ flex: 1, fontSize: 15.5, fontWeight: 800, color: 'var(--ink)' }}>{id === 'me' ? 'You' : p.name}</span>
                {on ? <span style={{ width: 24, height: 24, borderRadius: 999, background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><_GI name="check" size={15} color="var(--on-brand)" stroke={3} /></span>
                  : <span style={{ width: 24, height: 24, borderRadius: 999, border: '2px solid var(--line-strong)' }} />}
              </button>
            );
          })}
        </div>
      )}

      {cur === 'confirm' && (
        <div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', padding: 16, boxShadow: 'var(--shadow-card)' }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--muted)' }}>Winner</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 7 }}>
              <_GAv player={playerOf(winner, me)} size={40} />
              <span style={{ fontSize: 18, fontWeight: 850, color: 'var(--ink)' }}>{winner === 'me' ? 'You' : playerOf(winner, me).name}</span>
              <_GI name="sparkle" size={18} color="var(--brand)" />
            </div>
            <div style={{ height: 1, background: 'var(--line)', margin: '14px 0' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {roster.map(id => (
                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <_GAv player={playerOf(id, me)} size={26} />
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{id === 'me' ? 'You' : playerOf(id, me).name}</span>
                  {decks[id] ? <span style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 600 }}>· {decks[id]}</span> : null}
                </div>
              ))}
            </div>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 600, textAlign: 'center', margin: '12px 4px 0', lineHeight: 1.45 }}>
            The other players get a prompt to confirm before it counts toward stats.
          </div>
        </div>
      )}

      <div style={{ marginTop: 22 }}>
        {step < STEPS.length - 1
          ? <_GB variant="primary" full icon="arrowR" onClick={canNext ? () => setStep(step + 1) : undefined} disabled={!canNext}>Continue</_GB>
          : <_GB variant="primary" full icon="check" onClick={submit}>Log game</_GB>}
      </div>
    </div>
  );
}

function _GRosterRow({ player, on, onToggle, locked, label }) {
  return (
    <button onClick={locked ? undefined : onToggle} style={{
      display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', cursor: locked ? 'default' : 'pointer', fontFamily: 'inherit',
      background: on ? 'var(--brand-soft)' : 'var(--surface)', border: on ? '1.5px solid var(--brand)' : '1.5px solid var(--line)',
      borderRadius: 'var(--r-md)', padding: 11, opacity: locked && !on ? 0.6 : 1,
    }}>
      <_GAv player={player} size={40} />
      <span style={{ flex: 1, fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>{label || player.name}</span>
      {on ? <span style={{ width: 22, height: 22, borderRadius: 999, background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><_GI name="check" size={13} color="var(--on-brand)" stroke={3} /></span>
        : <span style={{ width: 22, height: 22, borderRadius: 999, border: '2px solid var(--line-strong)' }} />}
    </button>
  );
}

const _gInput = { width: '100%', boxSizing: 'border-box', padding: '11px 13px', fontSize: 15, fontFamily: 'inherit', fontWeight: 600,
  color: 'var(--ink)', background: 'var(--surface)', border: '1.5px solid var(--line)', borderRadius: 'var(--r-md)', outline: 'none' };

Object.assign(window, { gameStats, GameStatsStrip, RecentGames, ConfirmGamesSection, LogGameFlow });
