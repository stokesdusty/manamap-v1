// manamap — audit mockups. New proposed screens in the app's visual language.
// Reuses: Icon (icons.jsx), IOSDevice (ios-frame.jsx). Mounts into #root.
const { Icon: MK } = window;
const { useState: useS } = React;

// "me" identity (matches the prototype profile: Riffle · Izzet U/R)
const ME = { name: 'Riffle', handle: '@riffle', initials: 'R', colors: ['U', 'R'] };
const ACC = '#3E8FE6';      // U blue — identity accent
const ACC2 = '#EC5B47';     // R red
const GRAD = `linear-gradient(135deg, ${ACC} 0%, #7C5CC4 52%, ${ACC2} 100%)`;
const MANA = { W: '#D7A93C', U: '#3E8FE6', B: '#8E63D6', R: '#EC5B47', G: '#4FA85C', C: '#8E8896' };

// ── shared bits ───────────────────────────────────────────
function Pip({ c, s = 15 }) {
  return <span style={{ width: s, height: s, borderRadius: 999, background: MANA[c], display: 'inline-block', border: '1.5px solid rgba(255,255,255,0.16)' }} />;
}
function Avatar({ initials, colors, size = 44, r = 13 }) {
  const g = colors && colors.length > 1
    ? `linear-gradient(135deg, ${MANA[colors[0]]}, ${MANA[colors[colors.length - 1]]})`
    : MANA[(colors && colors[0]) || 'C'];
  return (
    <div style={{ width: size, height: size, borderRadius: r, background: g, display: 'flex',
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      fontWeight: 800, color: '#fff', fontSize: size * 0.4, letterSpacing: '-0.02em',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)' }}>{initials}</div>
  );
}
function Label({ children, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 9px' }}>
      <span style={{ flex: 1, fontSize: 12, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--muted)' }}>{children}</span>
      {action}
    </div>
  );
}
function card(extra) {
  return { background: 'var(--surface)', borderRadius: 'var(--r-lg)', border: '1px solid var(--line)',
    boxShadow: 'var(--shadow-card)', ...extra };
}

// ── Tab bar ───────────────────────────────────────────────
function TabBar({ active = 'home', reqs = 2 }) {
  const items = [
    { k: 'home', label: 'Home', icon: <path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" /> },
    { k: 'nearby', label: 'Nearby', node: <MK name="radar" size={24} stroke={2} /> },
    { k: 'scan', label: 'Scan', center: true },
    { k: 'connect', label: 'Connect', node: <MK name="user" size={24} stroke={2} />, badge: reqs },
    { k: 'you', label: 'You', node: <MK name="user" size={24} stroke={2} /> },
  ];
  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 86, zIndex: 40,
      background: 'var(--tabbar-bg)', backdropFilter: 'blur(16px)', borderTop: '1px solid var(--line)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-around', paddingTop: 11 }}>
      {items.map(it => {
        const on = it.k === active;
        const col = on ? ACC : 'var(--tab-idle)';
        if (it.center) return (
          <div key={it.k} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 56 }}>
            <div style={{ width: 50, height: 38, borderRadius: 13, background: ACC, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 6px 16px ${ACC}66` }}>
              <MK name="qr" size={23} color="#fff" stroke={2.2} />
            </div>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--tab-idle)' }}>{it.label}</span>
          </div>
        );
        return (
          <div key={it.k} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 56, position: 'relative' }}>
            <div style={{ position: 'relative', color: col, display: 'flex' }}>
              {it.node || <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{it.icon}</svg>}
              {it.badge ? <span style={{ position: 'absolute', top: -5, right: -8, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999, background: '#E8484A', color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{it.badge}</span> : null}
            </div>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: col }}>{it.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function BannerPill({ children }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 750, color: '#fff', background: 'rgba(255,255,255,0.18)', padding: '4px 11px', borderRadius: 999, backdropFilter: 'blur(4px)' }}>{children}</span>;
}
function IdentityBanner() {
  return (
    <div style={{ backgroundImage: GRAD, paddingTop: 60, paddingBottom: 22, padding: '60px 18px 22px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, opacity: 0.14, backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.3) 0 1.5px, transparent 1.5px 14px)' }} />
      <button style={{ position: 'absolute', top: 58, right: 16, width: 40, height: 40, borderRadius: 999, border: 'none', background: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <MK name="bell" size={20} color="#fff" stroke={2.2} />
        <span style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 999, background: '#E8484A', border: '1.5px solid rgba(255,255,255,0.5)' }} />
      </button>
      <div style={{ position: 'relative' }}>
        <div style={{ fontSize: 13.5, fontWeight: 650, color: 'rgba(255,255,255,0.72)' }}>Evening,</div>
        <div style={{ fontSize: 34, fontWeight: 850, color: '#fff', letterSpacing: '-0.035em', lineHeight: 1.06, textShadow: '0 2px 14px rgba(0,0,0,0.18)' }}>{ME.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 13 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: '#4ade80', boxShadow: '0 0 8px rgba(74,222,128,0.85)' }} />
          <span style={{ fontSize: 14.5, fontWeight: 750, color: '#fff' }}>Dragon’s Den</span>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: 'rgba(255,255,255,0.85)', background: 'rgba(255,255,255,0.18)', padding: '2px 9px', borderRadius: 999 }}>Checked in ›</span>
        </div>
        <div style={{ display: 'flex', gap: 7, marginTop: 12, flexWrap: 'wrap' }}>
          <BannerPill>🔥 2w streak</BannerPill>
          <BannerPill>📅 Friday Commander · RSVP’d</BannerPill>
        </div>
      </div>
    </div>
  );
}

// ════════════════════ G1 · HOME REDESIGNED ════════════════════
function HomeRedesign() {
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--bg)', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: '0 0 86px 0', overflowY: 'auto' }}>
        <IdentityBanner />
        <div style={{ padding: '16px 16px 30px' }}>
          {/* ONE hero */}
          <div style={{ ...card({ padding: 18, position: 'relative', overflow: 'hidden', border: 'none' }), background: GRAD }}>
            <div style={{ position: 'absolute', inset: 0, opacity: 0.12, backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.4) 0 1.5px, transparent 1.5px 13px)' }} />
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MK name="sparkle" size={20} color="#fff" stroke={2.2} />
                <span style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.9)' }}>You’re checked in</span>
              </div>
              <div style={{ fontSize: 25, fontWeight: 850, color: '#fff', letterSpacing: '-0.03em', marginTop: 8 }}>Play tonight</div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginTop: 3 }}>6 players open · 2 pods forming here</div>
              <button style={{ marginTop: 15, width: '100%', height: 50, borderRadius: 15, border: 'none', background: '#fff', color: '#1a1622', fontFamily: 'inherit', fontSize: 15.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                Find me a game <MK name="arrowR" size={18} color="#1a1622" stroke={2.4} />
              </button>
            </div>
          </div>

          {/* inline single attention banner */}
          <button style={{ marginTop: 12, width: '100%', display: 'flex', alignItems: 'center', gap: 11, ...card({ padding: '13px 15px' }), textAlign: 'left' }}>
            <span style={{ width: 9, height: 9, borderRadius: 999, background: ACC, flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Confirm Wrenfield’s game</span>
            <MK name="chevR" size={17} color="var(--muted)" stroke={2.4} />
          </button>

          {/* demoted secondary grid */}
          <div style={{ marginTop: 20 }}>
            <Label>More</Label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { ic: 'cards', t: 'Log a Game', s: 'Record a result' },
                { ic: 'radar', t: 'Meet Players', s: '6 nearby now' },
                { ic: 'user', t: 'Connections', s: '2 pending', badge: 2 },
                { ic: 'swords', t: 'Your Decks', s: '3 brewing' },
              ].map(x => (
                <div key={x.t} style={{ ...card({ padding: 14, position: 'relative' }) }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--brand-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <MK name={x.ic} size={18} color={ACC} stroke={2} />
                  </div>
                  {x.badge ? <span style={{ position: 'absolute', top: 12, right: 12, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: '#E8484A', color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{x.badge}</span> : null}
                  <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--ink)', marginTop: 11 }}>{x.t}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginTop: 1 }}>{x.s}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <TabBar active="home" />
    </div>
  );
}

// ════════════════════ G5 · PLAY TONIGHT SHEET ════════════════════
function PlayTonightSheet() {
  const rows = [
    { ic: 'sparkle', t: 'Broadcast you’re open', s: 'Let players here know you want a game', tint: ACC },
    { ic: 'user', t: 'Join a forming pod', s: '2 pods forming at Dragon’s Den', tint: '#7C5CC4', chev: true },
    { ic: 'plus', t: 'Start a pod', s: 'Pick a power level, host the table', tint: ACC2 },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--bg)', overflow: 'hidden' }}>
      {/* dimmed home behind */}
      <div style={{ position: 'absolute', inset: 0, filter: 'blur(2px) brightness(0.5)', transform: 'scale(1.02)' }}>
        <IdentityBanner />
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,6,12,0.55)' }} />
      {/* sheet */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: 'var(--surface)', borderRadius: '26px 26px 0 0', padding: '12px 16px 30px', boxShadow: '0 -20px 60px rgba(0,0,0,0.5)' }}>
        <div style={{ width: 40, height: 5, borderRadius: 999, background: 'var(--line-strong)', margin: '0 auto 16px' }} />
        <div style={{ fontSize: 22, fontWeight: 850, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Play tonight</div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--muted)', marginTop: 2, marginBottom: 16 }}>Three ways to get into a game right now.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map(r => (
            <button key={r.t} style={{ display: 'flex', alignItems: 'center', gap: 13, width: '100%', textAlign: 'left', ...card({ padding: '14px 15px' }) }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: `${r.tint}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <MK name={r.ic} size={21} color={r.tint} stroke={2.1} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--ink)' }}>{r.t}</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)', marginTop: 1 }}>{r.s}</div>
              </div>
              <MK name="chevR" size={18} color="var(--muted)" stroke={2.2} />
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, justifyContent: 'center', marginTop: 16, fontSize: 12.5, fontWeight: 600, color: 'var(--muted)' }}>
          <MK name="radar" size={15} color="var(--muted)" stroke={2} /> Just browsing? Meet Players is on the Nearby tab.
        </div>
      </div>
    </div>
  );
}

// ════════════════════ G6 · POD AGREEMENT ════════════════════
const BRACKETS = [
  { k: '1', label: 'B1', sub: 'Casual' },
  { k: '2', label: 'B2', sub: 'Core' },
  { k: '3', label: 'B3', sub: 'Upgraded' },
  { k: '4', label: 'B4', sub: 'High' },
  { k: 'cedh', label: 'cEDH', sub: 'Max' },
];
function PodAgreement() {
  const [myBracket, setMyBracket] = useS('3');
  const [flags, setFlags] = useS({ combo: false, mld: false, proxy: true, fast: true });
  const members = [
    { ...ME, b: myBracket, me: true },
    { name: 'Pearl', initials: 'P', colors: ['W', 'U'], b: '3' },
    { name: 'Mossbrook', initials: 'M', colors: ['G'], b: '2' },
    { name: 'Sol Ringer', initials: 'S', colors: ['R', 'W'], b: '3' },
  ];
  const flagDefs = [
    { k: 'combo', t: 'No infinite combos' },
    { k: 'mld', t: 'No mass land destruction' },
    { k: 'proxy', t: 'Proxies welcome' },
    { k: 'fast', t: 'Fast mana OK' },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--bg)', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: '0 0 0 0', overflowY: 'auto', paddingBottom: 96 }}>
        {/* header */}
        <div style={{ padding: '60px 18px 16px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Avatar initials="P" colors={['W', 'U']} size={36} r={11} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 19, fontWeight: 850, color: 'var(--ink)', letterSpacing: '-0.02em' }}>Pearl’s pod</div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)' }}>Table 4 · Commander · 4 / 4 seated</div>
            </div>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: '#fff', background: '#4ade80', padding: '4px 10px', borderRadius: 999 }}>Pod ready</span>
          </div>
        </div>

        <div style={{ padding: '18px 16px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <MK name="shield" size={18} color={ACC} stroke={2.1} />
            <span style={{ fontSize: 18, fontWeight: 850, color: 'var(--ink)', letterSpacing: '-0.02em' }}>Set the table</span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.45 }}>Agree on a bracket &amp; house rules before you shuffle up. Everyone sees the consensus.</div>

          {/* my bracket */}
          <div style={{ ...card({ padding: 15, marginBottom: 12 }) }}>
            <Label>Your bracket</Label>
            <div style={{ display: 'flex', gap: 6 }}>
              {BRACKETS.map(b => {
                const on = myBracket === b.k;
                return (
                  <button key={b.k} onClick={() => setMyBracket(b.k)} style={{ flex: 1, padding: '9px 2px', borderRadius: 12, border: on ? `1.5px solid ${ACC}` : '1.5px solid var(--line)', background: on ? `${ACC}1a` : 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>
                    <div style={{ fontSize: 13.5, fontWeight: 850, color: on ? ACC : 'var(--ink)' }}>{b.label}</div>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: on ? ACC : 'var(--muted)', marginTop: 1 }}>{b.sub}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* house rules */}
          <div style={{ ...card({ padding: 15, marginBottom: 12 }) }}>
            <Label>House rules</Label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {flagDefs.map((f, i) => {
                const on = flags[f.k];
                return (
                  <button key={f.k} onClick={() => setFlags(s => ({ ...s, [f.k]: !s[f.k] }))} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 2px', background: 'none', border: 'none', borderTop: i ? '1px solid var(--line)' : 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                    <span style={{ flex: 1, fontSize: 14.5, fontWeight: 700, color: 'var(--ink)' }}>{f.t}</span>
                    <span style={{ width: 44, height: 26, borderRadius: 999, background: on ? ACC : 'var(--switch-off)', position: 'relative', transition: 'background .15s', flexShrink: 0 }}>
                      <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: 999, background: '#fff', transition: 'left .15s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* table state */}
          <Label>Table · 4 picks in</Label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {members.map(m => (
              <div key={m.name} style={{ flex: 1, ...card({ padding: '11px 6px' }), textAlign: 'center', position: 'relative', border: m.me ? `1.5px solid ${ACC}` : '1px solid var(--line)' }}>
                <Avatar initials={m.initials} colors={m.colors} size={32} r={10} />
                <div style={{ fontSize: 16, fontWeight: 850, color: 'var(--ink)', marginTop: 7 }}>{m.b === 'cedh' ? 'cEDH' : 'B' + m.b}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.me ? 'You' : m.name.split(' ')[0]}</div>
              </div>
            ))}
          </div>

          {/* consensus */}
          <div style={{ ...card({ padding: '14px 15px', border: 'none' }), background: 'var(--brand-soft)', display: 'flex', alignItems: 'center', gap: 11 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: ACC, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <MK name="check" size={20} color="#fff" stroke={2.6} />
            </div>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 850, color: 'var(--ink)' }}>Table agreed · Bracket 3</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginTop: 1 }}>Proxies welcome · Fast mana OK</div>
            </div>
          </div>
        </div>
      </div>
      {/* sticky CTA */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 16px 26px', background: 'linear-gradient(transparent, var(--bg) 30%)' }}>
        <button style={{ width: '100%', height: 52, borderRadius: 16, border: 'none', background: ACC, color: '#fff', fontFamily: 'inherit', fontSize: 16, fontWeight: 850, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: `0 8px 22px ${ACC}55` }}>
          <MK name="swords" size={19} color="#fff" stroke={2.2} /> Start game
        </button>
      </div>
    </div>
  );
}

// ════════════════════ G10 · DECK SHELF ════════════════════
function DeckShelf() {
  const decks = [
    { name: 'Yuriko Tempo', cmd: 'Niv-Mizzet, Parun', colors: ['U', 'R'], site: 'Moxfield', games: 18, wins: 11 },
    { name: 'Mono-G Stompy', cmd: 'Azusa, Lost but Seeking', colors: ['G'], site: 'Archidekt', games: 9, wins: 3 },
    { name: 'Dimir Mill', cmd: 'Yuriko, the Tenebrous Shadow', colors: ['U', 'B'], site: 'Moxfield', games: 6, wins: 4 },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--bg)', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '60px 16px 30px' }}>
        <div style={{ fontSize: 30, fontWeight: 850, color: 'var(--ink)', letterSpacing: '-0.03em', marginBottom: 3 }}>Your decks</div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 18 }}>Win rates from your confirmed games.</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {decks.map(d => {
            const wr = Math.round((d.wins / d.games) * 100);
            const g = d.colors.length > 1 ? `linear-gradient(135deg, ${MANA[d.colors[0]]}, ${MANA[d.colors[d.colors.length - 1]]})` : MANA[d.colors[0]];
            return (
              <div key={d.name} style={{ ...card({ overflow: 'hidden' }) }}>
                <div style={{ height: 72, background: g, position: 'relative', padding: '12px 15px', display: 'flex', alignItems: 'flex-end' }}>
                  <div style={{ position: 'absolute', inset: 0, opacity: 0.16, backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.5) 0 1.5px, transparent 1.5px 12px)' }} />
                  <div style={{ position: 'relative', display: 'flex', gap: 4 }}>
                    {d.colors.map(c => <Pip key={c} c={c} s={16} />)}
                  </div>
                  <span style={{ position: 'absolute', top: 12, right: 14, fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.9)', background: 'rgba(0,0,0,0.22)', padding: '3px 9px', borderRadius: 999 }}>{d.site}</span>
                </div>
                <div style={{ padding: '13px 15px 15px' }}>
                  <div style={{ fontSize: 16.5, fontWeight: 850, color: 'var(--ink)', letterSpacing: '-0.02em' }}>{d.name}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)', marginTop: 1 }}>{d.cmd}</div>
                  {/* win rate */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 13 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ height: 7, borderRadius: 999, background: 'var(--chip-bg)', overflow: 'hidden' }}>
                        <div style={{ width: wr + '%', height: '100%', borderRadius: 999, background: wr >= 50 ? '#4FA85C' : ACC2 }} />
                      </div>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)' }}>{wr}%</span>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--muted)' }}>{d.wins}/{d.games}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 13 }}>
                    <button style={{ flex: 1, height: 40, borderRadius: 12, border: '1px solid var(--line-strong)', background: 'transparent', color: 'var(--ink)', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <MK name="link" size={15} color="var(--ink-2)" stroke={2.1} /> View list
                    </button>
                    <button style={{ flex: 1, height: 40, borderRadius: 12, border: 'none', background: 'var(--brand-soft)', color: ACC, fontFamily: 'inherit', fontSize: 13.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <MK name="cards" size={15} color={ACC} stroke={2.1} /> Get cards
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          <button style={{ height: 52, borderRadius: 'var(--r-lg)', border: '1.5px dashed var(--line-strong)', background: 'transparent', color: 'var(--ink-2)', fontFamily: 'inherit', fontSize: 14.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
            <MK name="plus" size={18} color="var(--ink-2)" stroke={2.4} /> Link a deck
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 4, fontSize: 11.5, fontWeight: 600, color: 'var(--muted)' }}>
            “Get cards” opens your retailer · manamap may earn a referral
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════ G16 · MANAMAP PLUS ════════════════════
function PlusPaywall() {
  const feats = [
    { ic: 'pin', t: 'Travel mode', s: 'Find pods & players in any city you visit' },
    { ic: 'target', t: 'Advanced stats', s: 'Matchup analytics & per-commander win rates' },
    { ic: 'sparkle', t: 'Custom card themes', s: 'Foils & alt-art for your player card' },
    { ic: 'eye', t: 'Who viewed your card', s: 'See who checked you out' },
    { ic: 'radar', t: 'Unlimited LFG', s: 'Go open to play as often as you like' },
    { ic: 'swords', t: 'Priority pod seats', s: 'Jump the queue when a pod fills' },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--bg)', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, overflowY: 'auto' }}>
        {/* hero */}
        <div style={{ backgroundImage: GRAD, padding: '64px 20px 26px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, opacity: 0.14, backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.35) 0 1.5px, transparent 1.5px 14px)' }} />
          <button style={{ position: 'absolute', top: 58, right: 16, width: 34, height: 34, borderRadius: 999, border: 'none', background: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MK name="x" size={18} color="#fff" stroke={2.4} />
          </button>
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.2)', padding: '5px 12px', borderRadius: 999, backdropFilter: 'blur(4px)' }}>
              <MK name="sparkle" size={16} color="#fff" stroke={2.3} />
              <span style={{ fontSize: 12.5, fontWeight: 800, color: '#fff', letterSpacing: '0.03em' }}>manamap PLUS</span>
            </div>
            <div style={{ fontSize: 29, fontWeight: 850, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.1, marginTop: 14 }}>Go deeper into<br />the game you love</div>
          </div>
        </div>

        <div style={{ padding: '18px 16px 30px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {feats.map((f, i) => (
              <div key={f.t} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '12px 2px', borderTop: i ? '1px solid var(--line)' : 'none' }}>
                <div style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--brand-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <MK name={f.ic} size={20} color={ACC} stroke={2.1} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>{f.t}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)', marginTop: 1 }}>{f.s}</div>
                </div>
              </div>
            ))}
          </div>

          {/* price */}
          <div style={{ ...card({ padding: 16, marginTop: 16, border: `1.5px solid ${ACC}` }), display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 19, fontWeight: 850, color: 'var(--ink)', letterSpacing: '-0.02em' }}>$4.99<span style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}> / month</span></div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>or $39.99 / year · save 33%</div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 800, color: ACC, background: 'var(--brand-soft)', padding: '5px 11px', borderRadius: 999 }}>7-day trial</span>
          </div>

          <button style={{ marginTop: 14, width: '100%', height: 52, borderRadius: 16, border: 'none', background: ACC, color: '#fff', fontFamily: 'inherit', fontSize: 16, fontWeight: 850, boxShadow: `0 8px 22px ${ACC}55` }}>Start free trial</button>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 18, marginTop: 14 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--muted)' }}>Restore purchase</span>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--muted)' }}>Terms</span>
          </div>
          <div style={{ textAlign: 'center', marginTop: 14, fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Check-in, connecting &amp; safety are free, always.</div>
        </div>
      </div>
    </div>
  );
}

// ── canvas of phones ──────────────────────────────────────
const FRAMES = [
  { code: 'G1', title: 'Home — one hero, the rest demoted', tag: 'Design', node: <HomeRedesign /> },
  { code: 'G5', title: '“Play tonight” — one funnel, three branches', tag: 'UX', node: <PlayTonightSheet /> },
  { code: 'G6', title: 'Pod Agreement — Rule 0 consensus', tag: 'Signature', node: <PodAgreement /> },
  { code: 'G10', title: 'Deck shelf — win rate + buy links', tag: 'Feature · Revenue', node: <DeckShelf /> },
  { code: 'G16', title: 'manamap Plus — player subscription', tag: 'Monetize', node: <PlusPaywall /> },
];
const TAGC = { 'Design': '#5FB97E', 'UX': '#4FA9E6', 'Signature': '#9B7BE0', 'Feature · Revenue': '#C9962E', 'Monetize': '#C9962E' };

function Mockups() {
  return (
    <div style={{ display: 'flex', gap: 40, padding: '34px 44px 60px', alignItems: 'flex-start', width: 'max-content' }}>
      {FRAMES.map(f => (
        <div key={f.code} style={{ display: 'flex', flexDirection: 'column', gap: 16, width: 402 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: '#fff', background: '#2A6FDB', padding: '4px 10px', borderRadius: 7 }}>{f.code}</span>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#fff', background: TAGC[f.tag], padding: '4px 10px', borderRadius: 999 }}>{f.tag}</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#E8E2D6', marginTop: 10, letterSpacing: '-0.01em' }}>{f.title}</div>
          </div>
          <div data-theme="dusk" style={{ position: 'relative', width: 402, height: 874, borderRadius: 48, overflow: 'hidden', background: '#000', boxShadow: '0 40px 90px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06)' }}>
            {/* dynamic island */}
            <div style={{ position: 'absolute', top: 11, left: '50%', transform: 'translateX(-50%)', width: 126, height: 37, borderRadius: 24, background: '#000', zIndex: 80 }} />
            {/* status bar */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 70, display: 'flex', justifyContent: 'space-between', padding: '20px 30px 0', pointerEvents: 'none' }}>
              <span style={{ fontFamily: '-apple-system, system-ui', fontSize: 16, fontWeight: 700, color: '#fff' }}>9:41</span>
              <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <svg width="18" height="11" viewBox="0 0 19 12"><rect x="0" y="7.5" width="3.2" height="4.5" rx="0.7" fill="#fff"/><rect x="4.8" y="5" width="3.2" height="7" rx="0.7" fill="#fff"/><rect x="9.6" y="2.5" width="3.2" height="9.5" rx="0.7" fill="#fff"/><rect x="14.4" y="0" width="3.2" height="12" rx="0.7" fill="#fff"/></svg>
                <svg width="25" height="12" viewBox="0 0 27 13"><rect x="0.5" y="0.5" width="23" height="12" rx="3.5" stroke="#fff" strokeOpacity="0.4" fill="none"/><rect x="2" y="2" width="18" height="9" rx="2" fill="#fff"/></svg>
              </span>
            </div>
            {f.node}
            {/* home indicator */}
            <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', width: 139, height: 5, borderRadius: 100, background: 'rgba(255,255,255,0.5)', zIndex: 90 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Mockups />);
