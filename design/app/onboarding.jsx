// manamap — first-run profile onboarding. Live card-building flow.
// Depends on window globals: Avatar, ManaPip, ManaRow, Chip, Button, Switch, Icon,
// comboName, manaGradient, PlayerCard. Exports OnboardingFlow.
const { useState } = React;
const _ob = window;

const OB_COLORS = ['W', 'U', 'B', 'R', 'G'];
const OB_FORMATS = ['Commander', 'Modern', 'Standard', 'Pioneer', 'Legacy', 'Draft', 'Pauper', 'Brawl', 'Cube'];
const OB_VIBES = ['Casual', 'Casual-spicy', 'Competitive'];
const OB_STORES = [
  { name: 'Dragon\u2019s Den', city: 'Riverton' },
  { name: 'Top Deck Cafe', city: 'Riverton' },
  { name: 'The Sideboard', city: 'Eastvale' },
  { name: 'Mana Vault Games', city: 'Northgate' },
  { name: 'Gilded Goblin', city: 'Old Town' },
];

const POWER_LABELS = {
  1: 'Precon', 2: 'Precon+', 3: 'Casual', 4: 'Casual', 5: 'Focused',
  6: 'Focused', 7: 'Optimized', 8: 'High power', 9: 'cEDH-lite', 10: 'cEDH',
};

function initialsFrom(name) {
  const t = (name || '').trim();
  return t ? t[0].toUpperCase() : '?';
}

// ── live preview card (compact, builds as you go) ──────────
function OnboardPreview({ draft }) {
  const player = { colors: draft.colors, initials: initialsFrom(draft.name) };
  const hasColors = draft.colors.length > 0;
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 'var(--r-lg)', border: '1px solid var(--line)',
      boxShadow: 'var(--shadow-card)', padding: 16, margin: '0 16px',
    }}>
      <div style={{ display: 'flex', gap: 13, alignItems: 'center' }}>
        <div style={{ position: 'relative' }}>
          {hasColors ? (
            <_ob.Avatar player={player} size={56} />
          ) : (
            <div style={{
              width: 56, height: 56, borderRadius: '32%', background: 'var(--chip-bg)',
              border: '2px dashed var(--line-strong)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: 'var(--muted)', fontWeight: 800, fontSize: 22,
            }}>{initialsFrom(draft.name)}</div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 19, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.02em' }}>
              {draft.name || 'Your name'}
            </span>
            {draft.pronouns ? <span style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 600 }}>{draft.pronouns}</span> : null}
          </div>
          <div style={{ marginTop: 6, minHeight: 22, display: 'flex', alignItems: 'center', gap: 8 }}>
            {hasColors ? (
              <>
                <_ob.ManaRow colors={draft.colors} size={18} />
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)' }}>{_ob.comboName(draft.colors)}</span>
              </>
            ) : (
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)' }}>Pick your colors</span>
            )}
          </div>
        </div>
      </div>

      {(draft.formats.length > 0 || draft.vibe) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
          {draft.formats.slice(0, 4).map(f => <_ob.Chip key={f} size="sm">{f}</_ob.Chip>)}
          {draft.vibe ? <_ob.Chip size="sm" tone="brand">{draft.vibe}</_ob.Chip> : null}
        </div>
      )}
      {draft.commander ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 11 }}>
          <_ob.Icon name="shield" size={14} color="var(--muted)" />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{draft.commander}</span>
          {draft.power ? <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--brand-ink)', background: 'var(--brand-soft)', padding: '2px 8px', borderRadius: 999 }}>P{draft.power}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

// ── inputs ────────────────────────────────────────────────
function Field({ label, children, hint }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: '0.03em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 9 }}>{label}</div>
      {children}
      {hint ? <div style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 600, marginTop: 8, lineHeight: 1.45 }}>{hint}</div> : null}
    </div>
  );
}

function TextField({ value, onChange, placeholder }) {
  return (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{
      width: '100%', boxSizing: 'border-box', padding: '13px 15px', fontSize: 16, fontFamily: 'inherit',
      fontWeight: 600, color: 'var(--ink)', background: 'var(--surface)', border: '1.5px solid var(--line)',
      borderRadius: 'var(--r-md)', outline: 'none',
    }} onFocus={e => e.target.style.borderColor = 'var(--brand)'} onBlur={e => e.target.style.borderColor = 'var(--line)'} />
  );
}

function ColorPicker({ value, onToggle }) {
  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
      {OB_COLORS.map(c => {
        const on = value.includes(c);
        return (
          <button key={c} onClick={() => onToggle(c)} style={{
            flex: 1, aspectRatio: '1', border: 'none', background: 'none', cursor: 'pointer', padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
            transform: on ? 'scale(1.04)' : 'scale(1)', transition: 'transform .15s ease', opacity: on ? 1 : 0.5,
            filter: on ? 'none' : 'saturate(0.5)',
          }}>
            <_ob.ManaPip c={c} size={50} />
            {on && <span style={{ position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: 999, background: 'var(--brand)', border: '2px solid var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><_ob.Icon name="check" size={10} color="#fff" stroke={3.5} /></span>}
          </button>
        );
      })}
    </div>
  );
}

function ChipMulti({ options, value, onToggle }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map(o => {
        const on = value.includes(o);
        return (
          <button key={o} onClick={() => onToggle(o)} style={{
            padding: '9px 14px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em', transition: 'all .14s ease',
            border: on ? '1.5px solid var(--brand)' : '1.5px solid var(--line)',
            background: on ? 'var(--brand-soft)' : 'var(--surface)',
            color: on ? 'var(--brand-ink)' : 'var(--ink-2)',
          }}>{o}</button>
        );
      })}
    </div>
  );
}

function SingleChips({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map(o => {
        const on = value === o;
        return (
          <button key={o} onClick={() => onChange(on ? '' : o)} style={{
            padding: '9px 14px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 14, fontWeight: 700, transition: 'all .14s ease',
            border: on ? '1.5px solid var(--brand)' : '1.5px solid var(--line)',
            background: on ? 'var(--brand-soft)' : 'var(--surface)',
            color: on ? 'var(--brand-ink)' : 'var(--ink-2)',
          }}>{o}</button>
        );
      })}
    </div>
  );
}

function PowerStepper({ value, onChange }) {
  const v = value || 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--surface)', border: '1.5px solid var(--line)', borderRadius: 'var(--r-md)', padding: '10px 14px' }}>
      <button onClick={() => onChange(Math.max(1, (v || 1) - 1))} style={stepBtnStyle}><span style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink-2)', lineHeight: 1 }}>{'\u2212'}</span></button>
      <div style={{ flex: 1, textAlign: 'center' }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)' }}>{v ? `${v} / 10` : '\u2014'}</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>{v ? POWER_LABELS[v] : 'Optional'}</div>
      </div>
      <button onClick={() => onChange(Math.min(10, (v || 0) + 1))} style={stepBtnStyle}><span style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink-2)', lineHeight: 1 }}>+</span></button>
    </div>
  );
}
const stepBtnStyle = { width: 38, height: 38, borderRadius: 11, border: 'none', background: 'var(--chip-bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };

function StoreList({ value, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {OB_STORES.map(s => {
        const on = value === s.name;
        return (
          <button key={s.name} onClick={() => onChange(s.name)} style={{
            display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
            padding: 13, borderRadius: 'var(--r-md)', cursor: 'pointer', fontFamily: 'inherit',
            border: on ? '1.5px solid var(--brand)' : '1.5px solid var(--line)',
            background: on ? 'var(--brand-soft)' : 'var(--surface)', transition: 'all .14s ease',
          }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: on ? 'var(--brand)' : 'var(--chip-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <_ob.Icon name="pin" size={20} color={on ? 'var(--on-brand)' : 'var(--muted)'} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--ink)' }}>{s.name}</div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)' }}>{s.city}</div>
            </div>
            {on && <_ob.Icon name="check" size={20} color="var(--brand)" stroke={2.6} />}
          </button>
        );
      })}
    </div>
  );
}

// ── the flow ──────────────────────────────────────────────
function OnboardingFlow({ me, onFinish, onSkip }) {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [draft, setDraft] = useState({
    name: (me && me.name) || '', pronouns: (me && me.pronouns) || '',
    colors: [], formats: [], commander: '', power: null, vibe: '',
    discord: (me && me.discord) || '', decks: [], homeStore: '', discoverable: true,
  });
  const set = (patch) => setDraft(d => ({ ...d, ...patch }));
  const toggleIn = (key, val) => setDraft(d => ({ ...d, [key]: d[key].includes(val) ? d[key].filter(x => x !== val) : [...d[key], val] }));

  const STEPS = [
    { key: 'name', title: 'Welcome to manamap', sub: 'Let\u2019s build the card you\u2019ll share with players you meet.' },
    { key: 'colors', title: 'What\u2019s your color identity?', sub: 'Pick the colors you play. This sets your card\u2019s look.' },
    { key: 'play', title: 'How do you play?', sub: 'Your formats power who you get matched with.' },
    { key: 'contact', title: 'How do people reach you?', sub: 'Shared only after you both approve a connection.' },
    { key: 'store', title: 'Where do you play?', sub: 'Your home store is where discovery lights up.' },
  ];
  const cur = STEPS[step];

  const canNext = (
    step === 0 ? draft.name.trim().length > 0 :
    step === 1 ? draft.colors.length > 0 :
    step === 2 ? draft.formats.length > 0 :
    step === 3 ? true :
    step === 4 ? draft.homeStore.length > 0 : true
  );
  const optional = step === 3;

  const next = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else setDone(true);
  };
  const back = () => { if (step > 0) setStep(step - 1); };

  if (done) {
    const player = {
      name: draft.name, handle: '@' + draft.name.toLowerCase().replace(/\s+/g, ''), initials: initialsFrom(draft.name),
      colors: draft.colors, pronouns: draft.pronouns, formats: draft.formats,
      commander: draft.commander || 'Not set yet', power: draft.power || '7',
      vibe: draft.vibe || 'Casual', bio: draft.commander ? `Playing ${draft.commander}. Let\u2019s find a pod.` : 'New here \u2014 let\u2019s find a pod.',
    };
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', paddingTop: 54 }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 16px' }}>
          <div style={{ textAlign: 'center', padding: '14px 8px 22px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'var(--brand-soft)', color: 'var(--brand-ink)', fontWeight: 800, fontSize: 12.5, letterSpacing: '0.04em', textTransform: 'uppercase', padding: '6px 14px', borderRadius: 999 }}>
              <_ob.Icon name="sparkle" size={15} color="var(--brand-ink)" /> Your card is ready
            </div>
            <div style={{ fontSize: 25, fontWeight: 850, letterSpacing: '-0.02em', color: 'var(--ink)', marginTop: 14 }}>Welcome, {draft.name}!</div>
            <div style={{ fontSize: 14.5, color: 'var(--ink-2)', fontWeight: 600, marginTop: 6, lineHeight: 1.5 }}>This is what other players see when you meet.</div>
          </div>
          <_ob.PlayerCard p={player} variant="profile" />
        </div>
        <div style={{ flexShrink: 0, padding: '12px 16px 30px', borderTop: '1px solid var(--line)', background: 'var(--surface)' }}>
          <_ob.Button variant="primary" full icon="arrowR" onClick={() => onFinish && onFinish(draft)}>Enter manamap</_ob.Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', paddingTop: 54 }}>
      {/* top bar: back · progress · skip */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 14px 10px', flexShrink: 0 }}>
        <button onClick={back} style={{ width: 60, textAlign: 'left', border: 'none', background: 'none', cursor: step > 0 ? 'pointer' : 'default', color: step > 0 ? 'var(--brand)' : 'transparent', fontFamily: 'inherit', fontWeight: 700, fontSize: 15, padding: 8, display: 'flex', alignItems: 'center', gap: 2 }}>
          <_ob.Icon name="chevL" size={20} stroke={2.6} /> Back
        </button>
        <div style={{ display: 'flex', gap: 6 }}>
          {STEPS.map((s, i) => (
            <span key={s.key} style={{ width: i === step ? 22 : 7, height: 7, borderRadius: 999, background: i <= step ? 'var(--brand)' : 'var(--line-strong)', transition: 'all .25s ease' }} />
          ))}
        </div>
        <button onClick={() => onSkip && onSkip()} style={{ width: 60, textAlign: 'right', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)', fontFamily: 'inherit', fontWeight: 700, fontSize: 14, padding: 8 }}>Skip</button>
      </div>

      {/* live preview */}
      <OnboardPreview draft={draft} />

      {/* step content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 16px' }}>
        <div style={{ fontSize: 22, fontWeight: 850, letterSpacing: '-0.025em', color: 'var(--ink)', lineHeight: 1.15 }}>{cur.title}</div>
        <div style={{ fontSize: 14.5, color: 'var(--ink-2)', fontWeight: 600, marginTop: 7, marginBottom: 22, lineHeight: 1.5 }}>{cur.sub}</div>

        {step === 0 && (
          <>
            <Field label="Display name"><TextField value={draft.name} onChange={v => set({ name: v })} placeholder="What players will call you" /></Field>
            <Field label="Pronouns" hint="Optional — shown on your card."><TextField value={draft.pronouns} onChange={v => set({ pronouns: v })} placeholder="they/them" /></Field>
          </>
        )}

        {step === 1 && (
          <Field label="Color identity" hint={draft.colors.length ? `${_ob.comboName(draft.colors)} \u2014 tap to change` : 'Tap all the colors you play.'}>
            <ColorPicker value={draft.colors} onToggle={c => toggleIn('colors', c)} />
          </Field>
        )}

        {step === 2 && (
          <>
            <Field label="Formats you play" hint="Pick at least one."><ChipMulti options={OB_FORMATS} value={draft.formats} onToggle={f => toggleIn('formats', f)} /></Field>
            <Field label="Commander / signature deck" hint="Optional."><TextField value={draft.commander} onChange={v => set({ commander: v })} placeholder="e.g. Niv-Mizzet, Parun" /></Field>
            <Field label="Power level" hint="Optional — helps match you to the right table."><PowerStepper value={draft.power} onChange={v => set({ power: v })} /></Field>
            <Field label="Vibe"><SingleChips options={OB_VIBES} value={draft.vibe} onChange={v => set({ vibe: v })} /></Field>
          </>
        )}

        {step === 3 && (
          <>
            <Field label="Discord" hint="The handle people get when you connect."><TextField value={draft.discord} onChange={v => set({ discord: v })} placeholder="your_discord" /></Field>
            <Field label="Deck links" hint="Optional — paste a Moxfield or Archidekt link.">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {draft.decks.map((d, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)', border: '1.5px solid var(--line)', borderRadius: 'var(--r-md)', padding: '11px 13px' }}>
                    <_ob.Icon name="cards" size={18} color="var(--brand-ink)" />
                    <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d}</span>
                    <button onClick={() => set({ decks: draft.decks.filter((_, j) => j !== i) })} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 2 }}><_ob.Icon name="x" size={16} /></button>
                  </div>
                ))}
                <button onClick={() => set({ decks: [...draft.decks, 'moxfield.com/u/' + (draft.name || 'me').toLowerCase().replace(/\s+/g, '')] })} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '11px', borderRadius: 'var(--r-md)', border: '1.5px dashed var(--line-strong)', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: 'var(--brand-ink)' }}>
                  <_ob.Icon name="plus" size={17} stroke={2.4} /> Add a deck link
                </button>
              </div>
            </Field>
          </>
        )}

        {step === 4 && (
          <>
            <Field label="Home store"><StoreList value={draft.homeStore} onChange={v => set({ homeStore: v })} /></Field>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)', border: '1.5px solid var(--line)', borderRadius: 'var(--r-md)', padding: '14px', marginTop: 4 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>Discoverable nearby</div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 600, marginTop: 2, lineHeight: 1.4 }}>Let players at your store find you. You can turn this off anytime.</div>
              </div>
              <_ob.Switch on={draft.discoverable} onToggle={() => set({ discoverable: !draft.discoverable })} />
            </div>
          </>
        )}
      </div>

      {/* footer */}
      <div style={{ flexShrink: 0, padding: '12px 16px 30px', borderTop: '1px solid var(--line)', background: 'var(--surface)', display: 'flex', gap: 10 }}>
        {optional && (
          <_ob.Button variant="ghost" onClick={next}>Skip</_ob.Button>
        )}
        <div style={{ flex: 1 }}>
          <_ob.Button variant="primary" full icon={step === STEPS.length - 1 ? 'check' : 'arrowR'} onClick={canNext ? next : undefined} disabled={!canNext}>
            {step === STEPS.length - 1 ? 'Finish' : 'Continue'}
          </_ob.Button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { OnboardingFlow });
