import type { ReactNode } from "react";

interface IconProps {
  size?: number;
}

function Svg({ size = 14, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function IconSensor({ size }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
    </Svg>
  );
}

export function IconEsp32({ size }: IconProps) {
  return (
    <Svg size={size}>
      <rect x="4" y="6" width="16" height="12" rx="2" />
      <path d="M4 9H1M4 15H1M20 9h3M20 15h3" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconServer({ size }: IconProps) {
  return (
    <Svg size={size}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M5 8h8M5 12h8M5 16h8" />
      <circle cx="18" cy="8" r="1" fill="currentColor" stroke="none" />
      <circle cx="18" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="18" cy="16" r="1" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconGrid({ size }: IconProps) {
  return (
    <Svg size={size}>
      <rect x="4" y="4" width="16" height="16" />
      <path d="M4 12h16M12 4v16" />
    </Svg>
  );
}

export function IconRanges({ size }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="9" strokeDasharray="3 3" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconSnap({ size }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="9.5" strokeDasharray="2 2" opacity="0.55" />
    </Svg>
  );
}

export function IconCloud({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M7 18a4 4 0 0 1-.9-7.9A5.5 5.5 0 0 1 17 8.6a3.5 3.5 0 0 1 .6 6.9" />
    </Svg>
  );
}

export function IconCloudOff({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M7 18a4 4 0 0 1-.9-7.9A5.5 5.5 0 0 1 17 8.6a3.5 3.5 0 0 1 .6 6.9" />
      <path d="M4 4l16 16" />
    </Svg>
  );
}

export function IconPlus({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function IconClose({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  );
}

export function IconRect({ size }: IconProps) {
  return (
    <Svg size={size}>
      <rect x="4" y="4" width="16" height="16" />
    </Svg>
  );
}

export function IconCircle({ size }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="12" cy="12" r="8" />
    </Svg>
  );
}

export function IconRoute({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M4 19L12 12M4 5h8a4 4 0 0 1 4 4v6" />
      <path d="M17 7l3 3-3 3" />
    </Svg>
  );
}

export function IconTrash({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
      <path d="M10 11v6M14 11v6" />
    </Svg>
  );
}

export function IconCheck({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M5 13l4 4L19 7" />
    </Svg>
  );
}

export function IconAlert({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M12 3L2 20h20L12 3z" />
      <path d="M12 10v5M12 18v.5" />
    </Svg>
  );
}

export function IconExport({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M12 3v11M8 10l4 4 4-4" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </Svg>
  );
}

export function IconImport({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M12 14V3M8 7l4-4 4 4" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </Svg>
  );
}

export function IconPdf({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M6 3h8l4 4v14H6V3z" />
      <path d="M14 3v4h4" />
      <path d="M9 12v5M9 12h2a1.5 1.5 0 0 1 0 3M9 15h1.5M13 12v5l2-3 2 3v-5" />
    </Svg>
  );
}