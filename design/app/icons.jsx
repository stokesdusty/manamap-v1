// manamap — line icons. Exports Icon to window.
function Icon({ name, size = 24, color = 'currentColor', stroke = 2 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: color, strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const paths = {
    radar: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.4" fill={color} stroke="none" /></>,
    qr: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><path d="M14 14h3v3M21 14v0M17 21h4v-4M21 21v0" /></>,
    bell: <><path d="M18 8A6 6 0 1 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" /></>,
    chevR: <path d="M9 6l6 6-6 6" />,
    chevL: <path d="M15 6l-6 6 6 6" />,
    check: <path d="M5 12l5 5L20 6" />,
    x: <path d="M6 6l12 12M18 6L6 18" />,
    plus: <path d="M12 5v14M5 12h14" />,
    link: <><path d="M9 15l6-6" /><path d="M11 6l1-1a4 4 0 0 1 6 6l-1 1" /><path d="M13 18l-1 1a4 4 0 0 1-6-6l1-1" /></>,
    scan: <><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" /><path d="M4 12h16" /></>,
    pin: <><path d="M12 21s7-6.3 7-12a7 7 0 1 0-14 0c0 5.7 7 12 7 12z" /><circle cx="12" cy="9" r="2.5" /></>,
    discord: <><path d="M8 13a1 1 0 1 0 0-.01M16 13a1 1 0 1 0 0-.01" /><path d="M7 17c-2-1-3-4-3-7 0-2 1-3.5 2-4l2 1a10 10 0 0 1 8 0l2-1c1 .5 2 2.5 2 4 0 3-1 6-3 7l-1-2M9 18l-2 1M15 18l2 1" /></>,
    shield: <><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" /><path d="M9 12l2 2 4-4" /></>,
    sparkle: <><path d="M12 4l1.5 4.5L18 10l-4.5 1.5L12 16l-1.5-4.5L6 10l4.5-1.5z" /><path d="M19 15l.6 1.8L21 17l-1.4.6L19 19l-.6-1.4L17 17l1.4-.2z" /></>,
    edit: <><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M14 6l4 4" /></>,
    swap: <><path d="M7 4v13M7 4L4 7M7 4l3 3" /><path d="M17 20V7M17 20l3-3M17 20l-3-3" /></>,
    arrowR: <path d="M5 12h14M13 6l6 6-6 6" />,
    cards: <><rect x="3" y="6" width="13" height="14" rx="2" /><path d="M7 6V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-1" /></>,
  };
  return <svg {...common}>{paths[name] || null}</svg>;
}
Object.assign(window, { Icon });
