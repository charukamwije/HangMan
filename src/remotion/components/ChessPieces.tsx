import React from "react";

type PieceProps = { color: string; size: number; style?: React.CSSProperties; shade?: string };

/** Stylised Staunton pawn silhouette (viewBox 100×160). */
export const Pawn: React.FC<PieceProps> = ({ color, size, style, shade = "rgba(0,0,0,0.45)" }) => (
  <svg width={size} height={size * 1.6} viewBox="0 0 100 160" style={style}>
    <defs>
      <linearGradient id="pawnShade" x1="0" x2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
        <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity="0.45" />
      </linearGradient>
    </defs>
    <g fill={color}>
      <circle cx="50" cy="30" r="22" />
      <path d="M30 56 h40 l-4 10 h-32 z" />
      <path d="M36 66 h28 c2 26 10 44 22 58 h-72 c12-14 20-32 22-58 z" />
      <rect x="10" y="124" width="80" height="14" rx="4" />
      <rect x="4" y="138" width="92" height="16" rx="5" />
    </g>
    <g fill="url(#pawnShade)">
      <circle cx="50" cy="30" r="22" />
      <path d="M36 66 h28 c2 26 10 44 22 58 h-72 c12-14 20-32 22-58 z" />
      <rect x="4" y="138" width="92" height="16" rx="5" />
    </g>
    <ellipse cx="50" cy="156" rx="46" ry="4" fill={shade} />
  </svg>
);

/** Stylised king silhouette (viewBox 100×200). */
export const King: React.FC<PieceProps> = ({ color, size, style }) => (
  <svg width={size} height={size * 2} viewBox="0 0 100 200" style={style}>
    <defs>
      <linearGradient id="kingShade" x1="0" x2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0.3" />
        <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity="0.55" />
      </linearGradient>
    </defs>
    {[color, "url(#kingShade)"].map((fill) => (
      <g key={fill} fill={fill}>
        <rect x="45" y="2" width="10" height="30" rx="2" />
        <rect x="35" y="11" width="30" height="10" rx="2" />
        <path d="M22 44 c0-12 56-12 56 0 l-8 26 h-40 z" />
        <path d="M28 70 h44 l-4 10 h-36 z" />
        <path d="M34 80 h32 c2 40 10 62 22 82 h-76 c12-20 20-42 22-82 z" />
        <rect x="8" y="162" width="84" height="14" rx="4" />
        <rect x="2" y="176" width="96" height="18" rx="5" />
      </g>
    ))}
  </svg>
);

/** Rook silhouette (viewBox 100×170). */
export const Rook: React.FC<PieceProps> = ({ color, size, style }) => (
  <svg width={size} height={size * 1.7} viewBox="0 0 100 170" style={style}>
    <g fill={color}>
      <path d="M14 8 h16 v12 h12 v-12 h16 v12 h12 v-12 h16 v34 h-72 z" />
      <path d="M24 42 h52 l-4 10 h-44 z" />
      <path d="M30 52 h40 c1 34 6 58 16 80 h-72 c10-22 15-46 16-80 z" />
      <rect x="8" y="132" width="84" height="14" rx="4" />
      <rect x="2" y="146" width="96" height="18" rx="5" />
    </g>
    <path d="M60 8 h12 v134 h-12 z" fill="#000" opacity="0.25" />
  </svg>
);
