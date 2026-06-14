// manamap — retention: notifications inbox, monthly quests, friend-streaks.
// Exports NotificationsInbox, QuestsCard, FriendStreaks, notifMeta.
const { Avatar: _RAv, Icon: _RIc, SectionLabel: _RSL } = window;
const _MMr = window.MM;

// kind → icon + accent
const NOTIF_META = {
  request:      { icon: 'user',   tint: 'var(--brand)' },
  accept:       { icon: 'check',  tint: 'var(--brand)' },
  nearby:       { icon: 'radar',  tint: 'var(--brand)' },
  pod:          { icon: 'swords', tint: 'var(--brand)' },
  game_confirm: { icon: 'cards',  tint: 'var(--brand)' },
  event:        { icon: 'calendar', tint: 'var(--brand)' },
  broadcast:    { icon: 'pin',    tint: 'var(--brand)' },
  quest:        { icon: 'trophy', tint: 'var(--brand)' },
};

function NotificationsInbox({ notifs, me, onTap, onClear }) {
  const grouped = [];
  // simple split: unread first under "New", rest under "Earlier"
  const unread = notifs.filter(n => n.unread);
  const earlier = notifs.filter(n => !n.unread);
  return (
    <div style={{ padding: '4px 16px 28px' }}>
      {notifs.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--muted)' }}>
          <_RIc name="bell" size={40} color="var(--line-strong)" />
          <div style={{ fontSize: 16, fontWeight: 750, color: 'var(--ink-2)', marginTop: 12 }}>You’re all caught up</div>
          <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 3 }}>Connects, games, and store news land here.</div>
        </div>
      )}
      {unread.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px 9px' }}>
            <span style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--muted)' }}>New</span>
            <button onClick={onClear} style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: 'var(--brand-ink)', padding: 0, whiteSpace: 'nowrap' }}>Mark read</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 18 }}>
            {unread.map(n => <NotifRow key={n.id} n={n} me={me} onTap={onTap} />)}
          </div>
        </>
      )}
      {earlier.length > 0 && (
        <>
          {unread.length > 0 && <_RSL>Earlier</_RSL>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {earlier.map(n => <NotifRow key={n.id} n={n} me={me} onTap={onTap} />)}
          </div>
        </>
      )}
    </div>
  );
}

function NotifRow({ n, me, onTap }) {
  const meta = NOTIF_META[n.kind] || { icon: 'bell', tint: 'var(--brand)' };
  const player = n.playerId ? _MMr.byId(n.playerId) : null;
  return (
    <button onClick={() => onTap && onTap(n)} style={{
      display: 'flex', alignItems: 'flex-start', gap: 12, width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
      background: n.unread ? 'var(--brand-soft)' : 'var(--surface)', border: '1px solid var(--line)',
      borderRadius: 'var(--r-md)', padding: 13, position: 'relative',
    }}>
      {player
        ? <_RAv player={player} size={42} />
        : <span style={{ width: 42, height: 42, borderRadius: 13, background: 'var(--chip-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><_RIc name={meta.icon} size={21} color="var(--brand-ink)" /></span>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.3 }}>{n.title}</div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-2)', lineHeight: 1.4, marginTop: 3 }}>{n.body}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginTop: 5 }}>{n.when}</div>
      </div>
      {n.unread && <span style={{ width: 9, height: 9, borderRadius: 999, background: 'var(--brand)', flexShrink: 0, marginTop: 5 }} />}
    </button>
  );
}

// ── Monthly quests ────────────────────────────────────────
function QuestsCard({ quests }) {
  const doneCount = quests.filter(q => q.done).length;
  return (
    <div>
      <_RSL action={<span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--muted)' }}>{doneCount}/{quests.length} done</span>}>This month’s quests</_RSL>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {quests.map(q => {
          const pct = Math.round(100 * Math.min(q.progress, q.goal) / q.goal);
          return (
            <div key={q.id} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: 13, boxShadow: 'var(--shadow-row)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <span style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: q.done ? 'var(--brand)' : 'var(--chip-bg)' }}>
                  <_RIc name={q.done ? 'check' : q.icon} size={20} color={q.done ? 'var(--on-brand)' : 'var(--brand-ink)'} stroke={q.done ? 3 : 2} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--ink)' }}>{q.title}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)', marginTop: 1 }}>{q.sub}</div>
                </div>
                {q.done && <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--brand-ink)', background: 'var(--brand-soft)', padding: '3px 9px', borderRadius: 999 }}>DONE</span>}
              </div>
              {!q.done && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 11 }}>
                  <span style={{ flex: 1, height: 7, borderRadius: 999, background: 'var(--chip-bg)', overflow: 'hidden' }}>
                    <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: 'var(--brand)' }} />
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--ink-2)' }}>{q.progress}/{q.goal}</span>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 9 }}>
                <_RIc name="trophy" size={13} color="var(--muted)" />
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>{q.reward}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Friend-streaks ────────────────────────────────────────
function FriendStreaks({ streaks, me, onOpen }) {
  if (!streaks.length) return null;
  return (
    <div>
      <_RSL>Rivalries</_RSL>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {streaks.map(s => {
          const p = _MMr.byId(s.playerId);
          return (
            <button key={s.id} onClick={() => onOpen && onOpen(p)} style={{
              display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
              background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: 12, boxShadow: 'var(--shadow-row)',
            }}>
              <_RAv player={p} size={46} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--ink)' }}>{p.name}</span>
                  {s.hot && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11.5, fontWeight: 800, color: '#E0992E' }}><_RIc name="flame" size={13} color="#E0992E" /> {s.games}</span>}
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)', marginTop: 3 }}>{s.games} games · last {s.lastPlayed}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>{s.record}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>your record</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { NotificationsInbox, QuestsCard, FriendStreaks, NOTIF_META });
