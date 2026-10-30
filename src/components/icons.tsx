import type { ReactNode } from 'react';

const base = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, 'aria-hidden': true } as const;
const I = ({ children, size = 20 }: { children: ReactNode; size?: number }) => (
  <svg {...base} width={size} height={size}>
    {children}
  </svg>
);

export const Logo = ({ size = 32 }: { size?: number }) => (
  <svg width={size * 1.19} height={size} viewBox="0 0 38 32" aria-hidden="true">
    <path d="M19 7.34A10 10 0 0 1 19 24.66 10 10 0 0 1 19 7.34Z" fill="#35617a" />
    <circle cx="14" cy="16" r="10" fill="none" stroke="#2b2118" strokeWidth="1.8" />
    <circle cx="24" cy="16" r="10" fill="none" stroke="#2b2118" strokeWidth="1.8" />
  </svg>
);
export const Moon = () => (
  <I>
    <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" />
  </I>
);
export const Sun = () => (
  <I>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </I>
);
export const Eye = () => (
  <I>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </I>
);
export const EyeOff = () => (
  <I>
    <path d="M3 3l18 18M10.6 5.1A9.7 9.7 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.5 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.6 9.6 0 0 0 4.2-1" />
  </I>
);
export const Globe = () => (
  <I>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" />
  </I>
);
export const Video = () => (
  <I size={22}>
    <rect x="3" y="6" width="13" height="12" rx="2" />
    <path d="m16 10 5-3v10l-5-3" />
  </I>
);
export const Bell = () => (
  <I>
    <path d="M6 17V11a6 6 0 0 1 12 0v6l2 2H4l2-2Z" />
    <path d="M10 21a2 2 0 0 0 4 0" />
  </I>
);
export const Check = ({ size = 20 }: { size?: number }) => (
  <I size={size}>
    <path d="m5 12 5 5 9-10" strokeWidth={2.6} />
  </I>
);
export const Github = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.17 1.18a10.9 10.9 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.83 1.18 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
  </svg>
);
export const Plus = () => (
  <I size={18}>
    <path d="M12 5v14M5 12h14" />
  </I>
);
export const Copy = () => (
  <I size={18}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h8" />
  </I>
);
export const Chat = () => (
  <I size={18}>
    <path d="M4 5h16v11H9l-5 4V5Z" />
  </I>
);
