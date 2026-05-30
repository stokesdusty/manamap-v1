// manamap — Connect (requests/connections) + Profile screens.
const { Icon, Avatar, ManaRow, Chip, comboName, Button, Switch, SectionLabel, PlayerCard, ContactPanel, byId } = window;
const MMby = window.MM.byId;
const _RC = React;

// ── Connect tab ───────────────────────────────────────────
function ConnectScreen({ requests, connections, onAccept, onDecline, onOpenConn }) {
  return (
    <div style={{ padding: '2px 16px 24px' }}>
      <SectionLabel>{requests.length ? `${requests.length} request${requests.length > 1 ? 's' : ''}` : 'Requests'}</SectionLabel>
      {requests.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 22 }}>
          {requests.map(r => {
            const p = MMby(r.playerId);
            return (
              <div key={r.id} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', padding: 14, boxShadow: 'var(--shadow-card)' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <Avatar player={p} size={50} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                      <span style={{ fontSize: 16.5, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.02em' }}>{p.name}</span>
                      <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{r.when}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 5 }}>
                      <ManaRow colors={p.colors} size={16} />
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)' }}>via {r.via}</span>
                    </div>
                  </div>
                </div>
                {r.note && (
                  <div style={{ fontSize: 13.5, color: 'var(--ink-2)', fontWeight: 600, lineHeight: 1.45, marginTop: 11, background: 'var(--chip-bg)', borderRadius: 12, padding: '9px 12px' }}>“{r.note}”</div>
                )}
                <div style={{ display: 'flex', gap: 9, marginTop: 12 }}>
                  <Button variant="ghost" size="sm" full onClick={() => onDecline(r)}>Decline</Button>
                  <Button variant="primary" size="sm" full icon="check" onClick={() => onAccept(r)}>Accept</Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px dashed var(--line-strong)', borderRadius: 'var(--r-lg)', padding: '26px 20px', textAlign: 'center', marginBottom: 22 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-2)' }}>You’re all caught up</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600, marginTop: 3 }}>New requests show up here.</div>
        </div>
      )}

      <SectionLabel>Connections · {connections.length}</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {connections.map(c => {
          const p = MMby(c.playerId);
          return (
            <button key={c.id} onClick={() => onOpenConn(c)} style={{
              display: 'flex', alignItems: 'center', gap: 13, width: '100%', textAlign: 'left',
              background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)',
              padding: 12, cursor: 'pointer', fontFamily: 'inherit', boxShadow: 'var(--shadow-row)',
            }}>
              <Avatar player={p} size={48} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.02em' }}>{p.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 5 }}>
                  <ManaRow colors={p.colors} size={15} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>{c.metAt}</span>
                </div>
              </div>
              <Icon name="chevR" size={18} color="var(--muted)" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Profile (You) tab ─────────────────────────────────────
function ProfileScreen({ me, variant, privacy, onTogglePrivacy, onShare }) {
  const rows = [
    { key: 'discoverable', label: 'Discoverable nearby', sub: 'Let players at your store find you' },
    { key: 'showDiscord', label: 'Share Discord on connect', sub: 'Revealed only after you both approve' },
    { key: 'showDecks', label: 'Share deck links', sub: 'Moxfield & Archidekt URLs' },
    { key: 'showMetHistory', label: 'Show “met before”', sub: 'Surface past encounters at stores' },
  ];
  return (
    <div style={{ padding: '4px 16px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <PlayerCard p={me} variant={variant} />

      <div style={{ display: 'flex', gap: 10 }}>
        <Button variant="primary" full icon="qr" onClick={onShare}>Share my card</Button>
        <Button variant="outline" icon="edit" onClick={() => {}}>Edit</Button>
      </div>

      <div>
        <SectionLabel>Privacy</SectionLabel>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
          {rows.map((r, i) => (
            <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderTop: i ? '1px solid var(--line)' : 'none' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{r.label}</div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 600, marginTop: 2 }}>{r.sub}</div>
              </div>
              <Switch on={privacy[r.key]} onToggle={() => onTogglePrivacy(r.key)} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <SectionLabel>Your home store</SectionLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', padding: 14, boxShadow: 'var(--shadow-card)' }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: 'var(--brand-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="pin" size={22} color="var(--brand-ink)" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--ink)' }}>{me.homeStore}</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 600 }}>Check in to meet players here</div>
          </div>
          <Icon name="chevR" size={18} color="var(--muted)" />
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ConnectScreen, ProfileScreen });
