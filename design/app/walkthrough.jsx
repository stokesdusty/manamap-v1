// manamap — first-login app walkthrough. Exports WalkthroughOverlay.
// Spotlights key areas of the home screen + tab bar with tooltip cards.
const { useState: _Wus } = React;

const STEPS = [
  {
    id: 'home',
    title: 'Your home base',
    body: "Check in at your store, see tonight's events, and track your month — all in one place.",
    spot: { x: 0, y: 0, w: 402, h: 210, r: 0 },
    tipSide: 'below',
  },
  {
    id: 'open',
    title: 'Go open to play',
    body: "Tap here to let nearby players know you're ready for a pod right now. Goes live instantly.",
    spot: { x: 16, y: 220, w: 185, h: 118, r: 16 },
    tipSide: 'below',
  },
  {
    id: 'nearby',
    title: 'Discover nearby players',
    body: "Browse who's checked in at your store. Tap any card to view their profile and connect.",
    spot: { x: 89, y: 797, w: 64, h: 74, r: 12 },
    tipSide: 'above',
  },
  {
    id: 'scan',
    title: 'Scan to connect',
    body: "Your QR code lives here. Show it to another player — or scan theirs — to connect instantly.",
    spot: { x: 169, y: 792, w: 64, h: 82, r: 20 },
    tipSide: 'above',
  },
  {
    id: 'connect',
    title: 'Manage your network',
    body: "Accept requests, confirm game results, and stay in touch with your connections.",
    spot: { x: 249, y: 797, w: 64, h: 74, r: 12 },
    tipSide: 'above',
  },
];

const TIP_H = 178; // approximate tooltip card height in px

function WalkthroughOverlay({ onDone }) {
  const [idx, setIdx] = _Wus(0);
  const [pressed, setPressed] = _Wus(null);
  const step = STEPS[idx];
  const isLast = idx === STEPS.length - 1;
  const { spot, tipSide } = step;

  const tipY = tipSide === 'below'
    ? spot.y + spot.h + 18
    : spot.y - 18 - TIP_H;

  // dots row y
  const dotsY = tipSide === 'below'
    ? tipY + TIP_H + 10
    : tipY - 24;

  function advance() {
    if (isLast) onDone();
    else setIdx(i => i + 1);
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 200,
      pointerEvents: 'all', overflow: 'hidden',
    }}>
      {/* Dark overlay with spotlight hole */}
      <div style={{
        position: 'absolute',
        left: spot.x + 3, top: spot.y + 3,
        width: spot.w - 6, height: spot.h - 6,
        borderRadius: spot.r,
        boxShadow: '0 0 0 2000px rgba(0,0,0,0.76)',
        zIndex: 1,
        pointerEvents: 'none',
        transition: 'all .3s cubic-bezier(.4,0,.2,1)',
      }} />

      {/* Subtle ring around spotlight */}
      <div style={{
        position: 'absolute',
        left: spot.x + 1, top: spot.y + 1,
        width: spot.w - 2, height: spot.h - 2,
        borderRadius: spot.r + 2,
        border: '1.5px solid rgba(255,255,255,0.22)',
        zIndex: 2,
        pointerEvents: 'none',
        transition: 'all .3s cubic-bezier(.4,0,.2,1)',
      }} />

      {/* Step dots */}
      <div style={{
        position: 'absolute', left: 0, right: 0, top: dotsY,
        display: 'flex', justifyContent: 'center', gap: 7, zIndex: 4,
        pointerEvents: 'none',
      }}>
        {STEPS.map((_, i) => (
          <span key={i} style={{
            width: i === idx ? 22 : 7, height: 7, borderRadius: 999,
            background: i === idx ? '#fff' : 'rgba(255,255,255,0.3)',
            transition: 'all .25s ease',
            display: 'inline-block',
          }} />
        ))}
      </div>

      {/* Tooltip card */}
      <div style={{
        position: 'absolute',
        left: 20, right: 20, top: tipY,
        background: 'var(--surface)',
        borderRadius: 20,
        padding: '20px 20px 16px',
        zIndex: 3,
        boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
        transition: 'top .3s cubic-bezier(.4,0,.2,1)',
      }}>
        <div style={{
          fontSize: 18, fontWeight: 850, color: 'var(--ink)',
          letterSpacing: '-0.022em', lineHeight: 1.2, marginBottom: 8,
        }}>
          {step.title}
        </div>
        <div style={{
          fontSize: 13.5, fontWeight: 620, color: 'var(--ink-2)',
          lineHeight: 1.6, marginBottom: 18,
        }}>
          {step.body}
        </div>
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 12,
        }}>
          <button
            onClick={onDone}
            style={{
              border: 'none', background: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
              color: 'var(--muted)', padding: '8px 4px',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            Skip tour
          </button>
          <button
            onPointerDown={() => setPressed('next')}
            onPointerUp={() => setPressed(null)}
            onPointerLeave={() => setPressed(null)}
            onClick={advance}
            style={{
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 15, fontWeight: 800, color: 'var(--on-brand)',
              background: 'var(--brand)', borderRadius: 13,
              padding: '10px 24px',
              transition: 'transform .1s ease',
              transform: pressed === 'next' ? 'scale(0.96)' : 'scale(1)',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {isLast ? "Let\u2019s go \u2192" : 'Next \u2192'}
          </button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { WalkthroughOverlay });
