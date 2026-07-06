// manamap Partner Portal — shared line-icon set.
// Small, dependency-free stroke icons matching the mobile app's icon language.
import type { CSSProperties } from 'react';

const PATHS: Record<string, JSX.Element> = {
  store: (
    <>
      <path d="M3 9l1.2-5h15.6L21 9" />
      <path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" />
      <path d="M9 20v-6h6v6" />
      <path d="M3 9h18" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
    </>
  ),
  megaphone: (
    <>
      <path d="M3 11v3a1 1 0 0 0 1 1h2l2 5h2l-1.4-5H11l7 4V6l-7 4H3z" />
      <path d="M3 11h5" />
    </>
  ),
  ticket: (
    <>
      <path d="M4 8a2 2 0 0 0 0 4v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3a2 2 0 0 1 0-4V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2z" />
      <path d="M13 4.5v3M13 10.5v3M13 16.5v3" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
      <path d="M9.2 12.2l1.8 1.8 3.8-3.8" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20c0-3.5 2.5-6 5.5-6s5.5 2.5 5.5 6" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M15.5 13.5c2.4.3 4 2.2 4 5.5" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M20 20H4" />
    </>
  ),
  gift: (
    <>
      <rect x="4" y="9" width="16" height="11" rx="1.5" />
      <path d="M4 13h16" />
      <path d="M12 9v11" />
      <path d="M12 9C9.5 9 8 7.6 8 6a2 2 0 0 1 4 0 2 2 0 0 1 4 0c0 1.6-1.5 3-4 3z" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  chevronRight: <path d="M9 5l7 7-7 7" />,
  chevronLeft: <path d="M15 5l-7 7 7 7" />,
  check: <path d="M5 13l4 4L19 7" />,
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 12.3l2.3 2.3 4.7-4.8" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3.5l9.2 16H2.8z" />
      <path d="M12 10v4M12 17.2v.1" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="M3.5 6.5L12 13l8.5-6.5" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6z" />
    </>
  ),
  externalLink: (
    <>
      <path d="M9 6H5.5a1.5 1.5 0 0 0-1.5 1.5v11A1.5 1.5 0 0 0 5.5 20h11a1.5 1.5 0 0 0 1.5-1.5V15" />
      <path d="M14 4h6v6M20 4l-9 9" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M20 20l-4.8-4.8" />
    </>
  ),
  logOut: (
    <>
      <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" />
      <path d="M14 15l4-3-4-3M18 12H8" />
    </>
  ),
  inbox: (
    <>
      <path d="M3.5 12h5l1.5 3h4l1.5-3h5" />
      <path d="M6 5h12l2.5 7v7a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1v-7z" />
    </>
  ),
  zap: <path d="M13 3L5 14h5l-1 7 8-11h-5z" />,
  bolt: <path d="M13 3L5 14h5l-1 7 8-11h-5z" />,
  hash: <path d="M5 9h14M5 15h14M9 4L7 20M17 4l-2 16" />,
  mapMarker: (
    <>
      <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.4" />
    </>
  ),
};

export function Icon({
  name,
  size = 18,
  color = 'currentColor',
  strokeWidth = 2,
  style,
}: {
  name: keyof typeof PATHS | string;
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: CSSProperties;
}) {
  const path = PATHS[name];
  if (!path) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      {path}
    </svg>
  );
}
