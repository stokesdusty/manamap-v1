// manamap — social card. Exports SocialsCard, SocialsManageSheet, SOCIAL_META.
const { Icon: _SI, Segmented: _SSeg, Button: _SB, SectionLabel: _SSL } = window;
const { useState: _sus } = React;

// platform → label, icon, brand color, how to render the value
const SOCIAL_META = {
  discord:   { label: 'Discord',   icon: 'discord',   color: '#5865F2', pre: '' },
  twitch:    { label: 'Twitch',    icon: 'twitch',    color: '#9146FF', pre: 'twitch.tv/' },
  youtube:   { label: 'YouTube',   icon: 'youtube',   color: '#FF3B30', pre: '' },
  instagram: { label: 'Instagram', icon: 'instagram', color: '#E1306C', pre: '@' },
  xcom:      { label: 'X',         icon: 'xcom',      color: '#52525B', pre: '@' },
  facebook:  { label: 'Facebook',  icon: 'facebook',  color: '#1877F2', pre: '' },
  phone:     { label: 'Phone',     icon: 'phone',     color: '#34C759', pre: '' },
  website:   { label: 'Website',   icon: 'globe',     color: '#14B8A6', pre: '' },
  tiktok:    { label: 'TikTok',    icon: 'tiktok',    color: '#FE2C55', pre: '@' },
};
const VIS_META = {
  public:  { label: 'Public',  icon: 'eye' },
  friends: { label: 'Friends', icon: 'users' },
  hidden:  { label: 'Hidden',  icon: 'lock' },
};
const ALL_PLATFORMS = ['discord', 'instagram', 'twitch', 'youtube', 'xcom', 'tiktok', 'facebook', 'website', 'phone'];

function displayValue(s) {
  const m = SOCIAL_META[s.platform];
  if (!m) return s.value;
  if (s.platform === 'phone') return s.value;
  return m.pre + s.value;
}

// ── monochrome icon tile — brand color only fills when `active` (press/select);
// otherwise a thin 2px edge keeps the platform recognizable without competing
// with the identity gradient for attention.
function SocialTile({ platform, size = 44, dim, active }) {
  const m = SOCIAL_META[platform] || SOCIAL_META.website;
  return (
    <span style={{
      width: size, height: size, borderRadius: size * 0.3, flexShrink: 0,
      background: active ? m.color : 'var(--chip-bg)',
      border: active ? 'none' : `2px solid ${m.color}`,
      boxSizing: 'border-box',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      opacity: dim ? 0.4 : 1,
    }}>
      <_SI name={m.icon} size={size * 0.5} color={active ? '#fff' : 'var(--ink-2)'} stroke={2.2} />
    </span>
  );
}

function VisBadge({ vis, onClick }) {
  const v = VIS_META[vis];
  const tone = vis === 'public' ? 'var(--brand-ink)' : vis === 'friends' ? '#D9952E' : 'var(--muted)';
  const bg = vis === 'public' ? 'var(--brand-soft)' : vis === 'friends' ? 'color-mix(in srgb, #D9952E 16%, var(--surface))' : 'var(--chip-bg)';
  return (
    <button onClick={onClick} disabled={!onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', cursor: onClick ? 'pointer' : 'default',
      fontFamily: 'inherit', fontSize: 11, fontWeight: 800, letterSpacing: '0.02em',
      padding: '3px 9px', borderRadius: 999, color: tone, background: bg,
    }}>
      <_SI name={v.icon} size={11} color={tone} stroke={2.4} /> {v.label}
    </button>
  );
}

// ── the card ──────────────────────────────────────────────
// mode: 'owner' | 'friend' | 'public'
function SocialsCard({ socials, mode = 'public', onManage, onCopy }) {
  const visible = socials.filter(s => mode === 'owner' ? true : (s.vis === 'public' || (mode === 'friend' && s.vis === 'friends')));
  const railItems = mode === 'owner' ? socials.filter(s => s.vis !== 'hidden') : visible;
  const friendsOnlyHidden = mode === 'public' ? socials.filter(s => s.vis === 'friends').length : 0;
  const counts = {
    pub: socials.filter(s => s.vis === 'public').length,
    fr: socials.filter(s => s.vis === 'friends').length,
    hid: socials.filter(s => s.vis === 'hidden').length,
  };

  return (
    <div>
      <_SSL action={mode === 'owner' ? (
        <button onClick={onManage} style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 750, color: 'var(--brand-ink)', display: 'inline-flex', alignItems: 'center', gap: 4, padding: 0 }}>
          <_SI name="edit" size={14} stroke={2.4} /> Manage
        </button>
      ) : null}>Socials</_SSL>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
        {/* colorful rail */}
        {railItems.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: '15px 15px 13px' }}>
            {railItems.map(s => <SocialTile key={s.platform} platform={s.platform} dim={mode === 'owner' && s.vis === 'hidden'} />)}
          </div>
        )}

        {/* rows */}
        {(mode !== 'owner') && visible.map((s, i) => {
          const m = SOCIAL_META[s.platform] || SOCIAL_META.website;
          return (
            <div key={s.platform} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 15px', borderTop: '1px solid var(--line)' }}>
              <span style={{ width: 30, height: 30, borderRadius: 9, boxSizing: 'border-box', background: 'var(--chip-bg)', border: `2px solid ${m.color}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <_SI name={m.icon} size={16} color="var(--ink-2)" stroke={2.3} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--muted)' }}>{m.label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayValue(s)}</div>
              </div>
              {s.vis === 'friends' && <_SI name="users" size={14} color="#D9952E" />}
              <button onClick={() => onCopy && onCopy(s)} style={{ border: 'none', background: 'var(--chip-bg)', cursor: 'pointer', width: 32, height: 32, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <_SI name={s.platform === 'phone' || s.platform === 'discord' ? 'copy' : 'arrowR'} size={15} color="var(--ink-2)" />
              </button>
            </div>
          );
        })}

        {/* owner summary */}
        {mode === 'owner' && (
          <div style={{ display: 'flex', gap: 8, padding: '0 15px 15px', flexWrap: 'wrap' }}>
            <VisBadge vis="public" /><span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--muted)', alignSelf: 'center' }}>{counts.pub}</span>
            <VisBadge vis="friends" /><span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--muted)', alignSelf: 'center' }}>{counts.fr}</span>
            {counts.hid > 0 && <><VisBadge vis="hidden" /><span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--muted)', alignSelf: 'center' }}>{counts.hid}</span></>}
          </div>
        )}

        {/* public teaser */}
        {mode === 'public' && friendsOnlyHidden > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 15px', borderTop: '1px solid var(--line)', color: 'var(--muted)' }}>
            <_SI name="users" size={15} color="var(--muted)" />
            <span style={{ fontSize: 12.5, fontWeight: 700 }}>+{friendsOnlyHidden} more shared once you connect</span>
          </div>
        )}
        {visible.length === 0 && mode !== 'owner' && (
          <div style={{ padding: '16px 15px', fontSize: 13, fontWeight: 600, color: 'var(--muted)', textAlign: 'center' }}>No public socials yet.</div>
        )}
      </div>
    </div>
  );
}

// ── manage sheet ──────────────────────────────────────────
function SocialsManageSheet({ socials, onChange, onClose }) {
  const [rows, setRows] = _sus(socials);
  const [adding, setAdding] = _sus(false);
  const setVis = (platform, vis) => setRows(rs => rs.map(r => r.platform === platform ? { ...r, vis } : r));
  const remove = (platform) => setRows(rs => rs.filter(r => r.platform !== platform));
  const addPlatform = (platform) => { setRows(rs => [...rs, { platform, value: '', vis: 'public' }]); setAdding(false); };
  const setValue = (platform, value) => setRows(rs => rs.map(r => r.platform === platform ? { ...r, value } : r));
  const save = () => { onChange(rows.filter(r => r.value.trim())); onClose(); };

  const unused = ALL_PLATFORMS.filter(p => !rows.some(r => r.platform === p));

  return (
    <div style={{ padding: '6px 18px 28px' }}>
      <div style={{ width: 40, height: 5, borderRadius: 999, background: 'var(--line-strong)', margin: '0 auto 16px' }} />
      <div style={{ fontSize: 22, fontWeight: 850, letterSpacing: '-0.025em', color: 'var(--ink)', marginBottom: 4 }}>Your socials</div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 18, lineHeight: 1.45 }}>Choose who can see each one. Friends-only links unlock after you connect.</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        {rows.map(s => {
          const m = SOCIAL_META[s.platform] || SOCIAL_META.website;
          return (
            <div key={s.platform} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: 13 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 11 }}>
                <span style={{ width: 34, height: 34, borderRadius: 10, boxSizing: 'border-box', background: 'var(--chip-bg)', border: `2px solid ${m.color}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <_SI name={m.icon} size={18} color="var(--ink-2)" stroke={2.3} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--ink)' }}>{m.label}</div>
                </div>
                <button onClick={() => remove(s.platform)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}><_SI name="x" size={16} /></button>
              </div>
              <input value={s.value} onChange={e => setValue(s.platform, e.target.value)} placeholder={s.platform === 'phone' ? '(555) 555-0123' : m.pre + 'username'} style={{
                width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: 14.5, fontFamily: 'inherit', fontWeight: 600,
                color: 'var(--ink)', background: 'var(--bg)', border: '1.5px solid var(--line)', borderRadius: 10, outline: 'none', marginBottom: 11,
              }} />
              <_SSeg value={s.vis} onChange={v => setVis(s.platform, v)} options={[
                { value: 'public', label: 'Public', icon: 'eye' },
                { value: 'friends', label: 'Friends', icon: 'users' },
                { value: 'hidden', label: 'Hidden', icon: 'lock' },
              ]} />
            </div>
          );
        })}
      </div>

      {adding ? (
        <div style={{ marginTop: 13, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: 13 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: '0.03em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>Add a platform</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
            {unused.map(p => {
              const m = SOCIAL_META[p];
              return (
                <button key={p} onClick={() => addPlatform(p)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: '1.5px solid var(--line)', background: 'var(--surface)', cursor: 'pointer', fontFamily: 'inherit', borderRadius: 999, padding: '7px 13px 7px 8px' }}>
                  <span style={{ width: 26, height: 26, borderRadius: 8, boxSizing: 'border-box', background: 'var(--chip-bg)', border: `2px solid ${m.color}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><_SI name={m.icon} size={15} color="var(--ink-2)" stroke={2.3} /></span>
                  <span style={{ fontSize: 13.5, fontWeight: 750, color: 'var(--ink)' }}>{m.label}</span>
                </button>
              );
            })}
            {!unused.length && <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>All platforms added.</span>}
          </div>
        </div>
      ) : (
        unused.length > 0 && (
          <button onClick={() => setAdding(true)} style={{ width: '100%', marginTop: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '12px', borderRadius: 'var(--r-md)', border: '1.5px dashed var(--line-strong)', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14.5, fontWeight: 750, color: 'var(--brand-ink)' }}>
            <_SI name="plus" size={17} stroke={2.4} /> Add a platform
          </button>
        )
      )}

      <div style={{ marginTop: 20 }}>
        <_SB variant="primary" full icon="check" onClick={save}>Save socials</_SB>
      </div>
    </div>
  );
}

Object.assign(window, { SocialsCard, SocialsManageSheet, SOCIAL_META });
