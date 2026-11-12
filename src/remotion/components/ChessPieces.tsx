import React from "react";

type PieceProps = { color: string; size: number; style?: React.CSSProperties; shade?: string };

/**
 * Shaded 3D Staunton pawn (viewBox 100×160), seen slightly from above.
 * Every part is drawn flat in `color`, then lit with colour-independent overlays:
 *  - a radial gradient on the head (sphere: key light top-left, core shadow bottom-right),
 *  - a horizontal "cylinder" gradient on the body, collar and base sides,
 *  - lighter ellipses for the tops of the collar and base tiers (they face the light),
 *  - a thin rim light on the right edge.
 * The bottom of the base sits at y ≈ 154 (96 % of the height); LivesRow's ledge relies on that.
 */
export const Pawn: React.FC<PieceProps> = ({ color, size, style, shade = "rgba(0,0,0,0.5)" }) => (
  <svg width={size} height={size * 1.6} viewBox="0 0 100 160" style={style}>
    <defs>
      <radialGradient id="pawnSphere" cx="0.38" cy="0.32" r="0.75">
        <stop offset="0" stopColor="#fff" stopOpacity="0.75" />
        <stop offset="0.22" stopColor="#fff" stopOpacity="0.18" />
        <stop offset="0.55" stopColor="#000" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity="0.6" />
      </radialGradient>
      <linearGradient id="pawnCyl" x1="0" x2="1">
        <stop offset="0" stopColor="#000" stopOpacity="0.5" />
        <stop offset="0.18" stopColor="#000" stopOpacity="0.1" />
        <stop offset="0.32" stopColor="#fff" stopOpacity="0.45" />
        <stop offset="0.42" stopColor="#fff" stopOpacity="0.08" />
        <stop offset="0.78" stopColor="#000" stopOpacity="0.32" />
        <stop offset="0.93" stopColor="#000" stopOpacity="0.55" />
        <stop offset="1" stopColor="#fff" stopOpacity="0.18" />
      </linearGradient>
      <linearGradient id="pawnTop" x1="0" x2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0.12" />
        <stop offset="0.35" stopColor="#fff" stopOpacity="0.4" />
        <stop offset="1" stopColor="#000" stopOpacity="0.15" />
      </linearGradient>
    </defs>

    {/* contact shadow */}
    <ellipse cx="50" cy="153" rx="46" ry="5" fill={shade} />

    {/* ---- base: lower tier (cylinder side, then its lit top) ---- */}
    <g fill={color}>
      <ellipse cx="50" cy="146" rx="44" ry="8" />
      <rect x="6" y="134" width="88" height="12" />
    </g>
    <ellipse cx="50" cy="146" rx="44" ry="8" fill="url(#pawnCyl)" />
    <rect x="6" y="134" width="88" height="12" fill="url(#pawnCyl)" />
    <ellipse cx="50" cy="134" rx="44" ry="8" fill={color} />
    <ellipse cx="50" cy="134" rx="44" ry="8" fill="url(#pawnTop)" />

    {/* ---- base: upper tier ---- */}
    <rect x="15" y="122" width="70" height="11" fill={color} />
    <rect x="15" y="122" width="70" height="11" fill="url(#pawnCyl)" />
    <ellipse cx="50" cy="133" rx="35" ry="5" fill={color} />
    <ellipse cx="50" cy="133" rx="35" ry="5" fill="url(#pawnCyl)" />
    <ellipse cx="50" cy="122" rx="35" ry="6" fill={color} />
    <ellipse cx="50" cy="122" rx="35" ry="6" fill="url(#pawnTop)" />

    {/* ---- body: flared bell ---- */}
    <path d="M38 66 C38 92 30 108 20 122 L80 122 C70 108 62 92 62 66 Z" fill={color} />
    <path d="M38 66 C38 92 30 108 20 122 L80 122 C70 108 62 92 62 66 Z" fill="url(#pawnCyl)" />

    {/* ---- collar ---- */}
    <rect x="27" y="58" width="46" height="7" fill={color} />
    <rect x="27" y="58" width="46" height="7" fill="url(#pawnCyl)" />
    <ellipse cx="50" cy="65" rx="23" ry="4" fill={color} />
    <ellipse cx="50" cy="65" rx="23" ry="4" fill="url(#pawnCyl)" />
    <ellipse cx="50" cy="58" rx="23" ry="5" fill={color} />
    <ellipse cx="50" cy="58" rx="23" ry="5" fill="url(#pawnTop)" />

    {/* ---- neck + head (sphere) ---- */}
    <rect x="41" y="48" width="18" height="10" fill={color} />
    <rect x="41" y="48" width="18" height="10" fill="url(#pawnCyl)" />
    <circle cx="50" cy="32" r="21" fill={color} />
    <circle cx="50" cy="32" r="21" fill="url(#pawnSphere)" />
    {/* specular glint + right rim light */}
    <ellipse cx="42" cy="23" rx="6" ry="4" fill="#fff" opacity="0.55" transform="rotate(-30 42 23)" />
    <path d="M68 24 A21 21 0 0 1 64 48" stroke="#fff" strokeOpacity="0.28" strokeWidth="2" fill="none" />
  </svg>
);
