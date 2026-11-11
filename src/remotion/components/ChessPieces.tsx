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
