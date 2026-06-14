// manamap — Discover + QR screens. Exports DiscoverScreen, QRSheet.
const { Icon, Avatar, ManaRow, Chip, comboName, Button, Segmented, manaGradient } = window;
const _R = React;

// ── Radar hero ────────────────────────────────────────────
function Radar({ players, onPick, me }) {
  // place up to 5 avatars at varying radius/angle
  const spots = [
    { a: -40, r: 0.78 }, { a: 60, r: 0.62 }, { a: 158, r: 0.85 },
    { a: 210, r: 0.5 }, { a: 110, r: 0.92 },
  ];
  return (
    <div style={{ position: 'relative', height: 218, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '4px 0 6px' }}>
      {/* rings */}
      {[1, 0.68, 0.4].map((s, i) => (
        <div key={i} style={{
          position: 'absolute', width: 200 * s, height: 200 * s, borderRadius: '50%',
          border: '1.5px solid var(--radar-ring)',
          boxShadow: i === 0 ? 'inset 0 0 60px color-mix(in srgb, var(--brand) 14%, transparent)' : 'none',
        }} />
      ))}
      {/* pulse */}
      {[0, 1].map(i => (
        <div key={'p' + i} style={{
          position: 'absolute', width: 60, height: 60, borderRadius: '50%',
          background: 'var(--brand)', opacity: 0.22,
          animation: `mm-pulse 3s ease-out ${i * 1.5}s infinite`,
        }} />
      ))}
      {/* center = me (identity gradient) */}
      <div style={{
        width: 60, height: 60, borderRadius: '50%', backgroundImage: 'var(--identity-grad)', zIndex: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 6px 22px color-mix(in srgb, var(--brand) 55%, transparent), inset 0 1px 1px rgba(255,255,255,0.4)',
        color: '#fff', fontWeight: 850, fontSize: 19, textShadow: '0 1px 3px rgba(0,0,0,0.3)',
        border: '2.5px solid var(--surface)',
      }}>{me ? me.initials : 'R'}</div>
      {/* nearby dots */}
      {players.slice(0, 5).map((p, i) => {
        const sp = spots[i];
        const rad = sp.a * Math.PI / 180;
        const x = Math.cos(rad) * 100 * sp.r;
        const y = Math.sin(rad) * 100 * sp.r;
        return (
          <button key={p.id} onClick={() => onPick(p)} style={{
            position: 'absolute', transform: `translate(${x}px, ${y}px)`, border: 'none', background: 'none',
            cursor: 'pointer', padding: 0, zIndex: 3,
          }}>
            <span style={{ display: 'block', animation: `mm-bob 4s ease-in-out ${i * 0.4}s infinite` }}>
              <Avatar player={p} size={40} ring={2.5} />
            </span>
          </button>
        );
      })}
    </div>
  );
}

function PlayerRow({ p, onOpen, pending }) {
  return (
    <button onClick={() => onOpen(p)} style={{
      display: 'flex', alignItems: 'center', gap: 13, width: '100%', textAlign: 'left',
      background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)',
      padding: 12, cursor: 'pointer', fontFamily: 'inherit', boxShadow: 'var(--shadow-row)',
      WebkitTapHighlightColor: 'transparent',
    }}>
      <Avatar player={p} size={52} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 16.5, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.02em' }}>{p.name}</span>
          {p.metBefore && <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--brand-ink)', background: 'var(--brand-soft)', padding: '2px 7px', borderRadius: 999 }}>MET</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 6 }}>
          <ManaRow colors={p.colors} size={17} />
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)' }}>{p.formats[0]} · {p.distance}m</span>
        </div>
      </div>
      {pending
        ? <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Pending</span>
        : <Icon name="chevR" size={18} color="var(--muted)" />}
    </button>
  );
}

function DiscoverScreen({ players, me, onOpen, sentSet, onShowCode, lfg, pods }) {
  const [filter, setFilter] = _R.useState('all');
  const shown = filter === 'met' ? players.filter(p => p.metBefore) : players;
  return (
    <div style={{ padding: '0 16px 24px' }}>
      {/* identity gradient location banner */}
      <div style={{
        position: 'relative', overflow: 'hidden', borderRadius: 'var(--r-lg)', padding: '16px 16px',
        backgroundImage: 'var(--identity-grad)', marginBottom: 16,
        boxShadow: '0 6px 22px color-mix(in srgb, var(--brand) 32%, transparent)',
      }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.5, backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.12) 0 2px, transparent 2px 12px)' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="pin" size={15} color="#fff" stroke={2.4} />
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.92)' }}>Checked in</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 850, letterSpacing: '-0.025em', color: '#fff', marginTop: 4, textShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>Dragon’s Den</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.9)', marginTop: 1 }}>Friday Commander · {players.length} players here</div>
        </div>
      </div>

      {lfg && (
        <>
          <window.LFGStatusBar open={lfg.open} session={lfg.session} onGoOpen={lfg.onGoOpen} onEdit={lfg.onEdit} onStop={lfg.onStop} />
          {pods && <window.PodsSection pods={pods.list} me={pods.me} onOpenPod={pods.onOpenPod} onStart={pods.onStart} />}
          <window.LFGSection sessions={lfg.sessions} onJoin={lfg.onJoin} onOpenPlayer={onOpen} />
        </>
      )}

      <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', border: '1px solid var(--line)', boxShadow: 'var(--shadow-card)', padding: '10px 14px 16px', marginBottom: 18 }}>
        <Radar players={players} onPick={onOpen} me={me} />
        <div style={{ textAlign: 'center', fontSize: 13.5, fontWeight: 700, color: 'var(--ink-2)' }}>
          <span style={{ color: 'var(--brand-ink)' }}>{players.length} players</span> nearby right now
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <Segmented value={filter} onChange={setFilter} options={[
          { value: 'all', label: 'Everyone' },
          { value: 'met', label: 'Met before' },
        ]} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {shown.map(p => <PlayerRow key={p.id} p={p} onOpen={onOpen} pending={sentSet.has(p.id)} />)}
        {!shown.length && <Empty label="No players you’ve met before are here yet." />}
      </div>
    </div>
  );
}

function Empty({ label }) {
  return <div style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--muted)', fontSize: 14, fontWeight: 600 }}>{label}</div>;
}

// ── QR sheet (My code / Scan) ─────────────────────────────
function QRBlock({ seed = 'riffle' }) {
  // deterministic pseudo-QR grid
  const N = 21;
  let h = 0; for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const rng = () => { h = (h * 1103515245 + 12345) & 0x7fffffff; return h / 0x7fffffff; };
  const cells = [];
  for (let i = 0; i < N * N; i++) cells.push(rng() > 0.52);
  const finder = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= N - 7) || (r >= N - 7 && c < 7);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${N}, 1fr)`, gap: 2, width: 184, height: 184 }}>
      {cells.map((on, i) => {
        const r = Math.floor(i / N), c = i % N;
        if (finder(r, c)) return <span key={i} />;
        return <span key={i} style={{ background: on ? 'var(--ink)' : 'transparent', borderRadius: 1.5 }} />;
      })}
      {/* finder squares */}
      {[[6, 6], [6, '92%'], ['92%', 6]].map((pos, i) => null)}
    </div>
  );
}

function FinderSquares() {
  const sq = (style) => (
    <div style={{ position: 'absolute', width: 44, height: 44, borderRadius: 11, border: '6px solid var(--ink)', ...style }}>
      <div style={{ position: 'absolute', inset: 7, borderRadius: 4, background: 'var(--ink)' }} />
    </div>
  );
  return <>{sq({ top: 0, left: 0 })}{sq({ top: 0, right: 0 })}{sq({ bottom: 0, left: 0 })}</>;
}

function QRSheet({ me, onClose, onScan }) {
  const [mode, setMode] = _R.useState('mine');
  return (
    <div style={{ padding: '6px 20px 28px' }}>
      <div style={{ width: 40, height: 5, borderRadius: 999, background: 'var(--line-strong)', margin: '0 auto 18px' }} />
      <div style={{ marginBottom: 20 }}>
        <Segmented value={mode} onChange={setMode} options={[
          { value: 'mine', label: 'My code', icon: 'qr' },
          { value: 'scan', label: 'Scan', icon: 'scan' },
        ]} />
      </div>

      {mode === 'mine' ? (
        <div style={{ textAlign: 'center' }}>
          <div style={{ position: 'relative', display: 'inline-block', padding: 22, background: '#fff', borderRadius: 24, boxShadow: '0 10px 30px rgba(40,30,20,0.16)' }}>
            <div style={{ position: 'relative', width: 200, height: 200 }}>
              <div style={{ position: 'absolute', inset: 8 }}><QRBlock seed={me.handle} /></div>
              <FinderSquares />
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 50, height: 50, borderRadius: 14, background: manaGradient(me.colors), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 22, boxShadow: '0 0 0 5px #fff', textShadow: '0 1px 2px rgba(0,0,0,.2)' }}>{me.initials}</div>
            </div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)', marginTop: 18 }}>{me.name}</div>
          <div style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 600, marginTop: 2 }}>{me.handle} · {comboName(me.colors)}</div>
          <div style={{ fontSize: 13.5, color: 'var(--ink-2)', fontWeight: 600, marginTop: 16, lineHeight: 1.5 }}>
            Have another player point their camera here to swap cards instantly.
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <div style={{ position: 'relative', width: 244, height: 244, margin: '0 auto', borderRadius: 28, overflow: 'hidden', background: '#1c1822' }}>
            <div style={{ position: 'absolute', inset: 0, background: manaGradient(['U', 'R'], 145), opacity: 0.5 }} />
            <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0 1px, transparent 1px 16px), repeating-linear-gradient(90deg, rgba(0,0,0,0.18) 0 1px, transparent 1px 16px)' }} />
            {/* corner brackets */}
            {[{ t: 18, l: 18, b: 'l t' }, { t: 18, r: 18 }, { b: 18, l: 18 }, { b: 18, r: 18 }].map((c, i) => (
              <div key={i} style={{ position: 'absolute', width: 34, height: 34, top: c.t, bottom: c.b, left: c.l, right: c.r,
                borderTop: c.t != null ? '4px solid #fff' : 'none', borderBottom: c.b != null ? '4px solid #fff' : 'none',
                borderLeft: c.l != null ? '4px solid #fff' : 'none', borderRight: c.r != null ? '4px solid #fff' : 'none',
                borderRadius: 8 }} />
            ))}
            <div style={{ position: 'absolute', left: 18, right: 18, height: 3, background: 'rgba(255,255,255,0.95)', boxShadow: '0 0 14px 3px rgba(255,255,255,0.8)', borderRadius: 2, animation: 'mm-scan 2.4s ease-in-out infinite' }} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-2)', marginTop: 18, lineHeight: 1.5 }}>
            Point at another player’s manamap code
          </div>
          <div style={{ marginTop: 18 }}>
            <Button variant="primary" full icon="qr" onClick={onScan}>Simulate a scan</Button>
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { DiscoverScreen, QRSheet, PlayerRow });
