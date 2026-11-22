import React from "react";
import { AbsoluteFill, Img, staticFile, useVideoConfig } from "remotion";
import { DESIGN_HEIGHT, DESIGN_WIDTH, SAFE_WIDTH, UPLOADS_DIR } from "./constants";
import { BODY_FONT, DISPLAY_FONT } from "./fonts";
import { getTheme, shadeA, type ThemeId } from "./themes";
import { normalizeWord, resolveHintLetter } from "./timeline";
import { Background } from "./components/Background";

/** Props for the Short's custom thumbnail (a 9:16 still, made from the reel's own content). */
export type ThumbnailProps = {
  hookText: string;
  word: string;
  /** Pre-filled letter; "" = the word's first letter (same rule as the reel). */
  hintLetter: string;
  /** Second letter on the board at frame 0 (the panel passes the reel's resolved value). */
  secondLetter?: string;
  themeId: ThemeId;
  /** Library category tag, e.g. "TV ANTI-HERO". Empty = no tag. */
  category?: string;
  /** Picture under public/ instead of the shelf scene (same as the reel). */
  backgroundImage?: string;
};

/** Power words that take the accent (same idea as the reel's banner). */
const EMPHASIS = /^(ONLY|FAIL|NOBODY|GENIUS|IMPOSSIBLE|HARDEST|\d+%?)$/;

/** Headline column: narrow, so most hooks stack into ~3 short, punchy lines. */
const HEADLINE_WIDTH = 1250;
/** Headline font size: the longest word (or a third of the text) fills the column. */
const headlineSize = (text: string) => {
  const longestWord = Math.max(...text.split(" ").map((w) => w.length), 1);
  const perLine = Math.max(longestWord, text.length / 3);
  return Math.floor(Math.max(170, Math.min(300, HEADLINE_WIDTH / (perLine * 0.47))));
};

/**
 * backgrounds/characters.jpg (two rows of four characters) is cut into two rows of portrait
 * panels, matched to the thumbnail mockup. All values are fractions of the canvas:
 *   band     the part of the canvas this row occupies
 *   shift    how far the picture moves down inside it (the bottom row drops 15 %, so its
 *            faces start below the "N LETTERS" line instead of behind the board)
 *   fade     [from, to] inside the band where the row fades into the dark middle
 *   dividers x positions of the hard black gaps between the four characters
 *   dim      black over the row (the mockup keeps the faces moody, not bright)
 */
const PANEL_ROWS = [
  { band: [0, 0.52], shift: 0, fade: "linear-gradient(180deg, #000 42%, rgba(0,0,0,0.45) 72%, transparent 100%)", dividers: [0.217, 0.512, 0.774], dim: 0.4 },
  { band: [0.66, 1], shift: 0.15, fade: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.6) 20%, #000 40%)", dividers: [0.226, 0.516, 0.768], dim: 0.3 },
] as const;
/** Width of the black gaps between panels (design px). */
const PANEL_GAP = 22;

/** The picture as two rows of portrait panels over near-black, with a soft glow behind the headline. */
/** The thumbnail picture per theme (With picture): the K-Drama scene for Seoul Cherry Blossom Night, else the characters. */
export const KDRAMA_PICTURE = "backgrounds/kdrama.png";
export const CHARACTERS_PICTURE = "backgrounds/characters.jpg";
export const thumbnailPictureFor = (themeId: ThemeId) => (themeId === "seoul-blossom" ? KDRAMA_PICTURE : CHARACTERS_PICTURE);

/**
 * Full-bleed picture (the K-Drama scene). It has its own artwork text painted in the middle
 * (category, headline, board, letter count) right where the thumbnail draws its own, so that band
 * is covered by a soft indigo fade: the "K-Drama" lettering, moon and tower above it and the couple
 * and blossoms below it stay visible.
 */
const FullBleedBackground: React.FC<{ image: string }> = ({ image }) => (
  <AbsoluteFill style={{ background: "#07061a" }}>
    <Img src={staticFile(image)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
    <AbsoluteFill
      style={{
        background:
          "linear-gradient(180deg, transparent 0%, transparent 16.5%, rgba(10,8,32,0.995) 21%, rgba(12,9,36,1) 46%, rgba(10,8,32,0.995) 71.5%, transparent 77.5%, transparent 100%)",
      }}
    />
    {/* soft blossom-pink glow behind the headline, and a faint night-sky blue at the band's edges */}
    <AbsoluteFill style={{ background: "radial-gradient(ellipse 52% 20% at 50% 50%, rgba(255,156,200,0.18), transparent 75%)" }} />
    <AbsoluteFill style={{ background: "radial-gradient(ellipse 90% 30% at 50% 46%, transparent 55%, rgba(40,46,110,0.25) 100%)" }} />
  </AbsoluteFill>
);


/**
 * An uploaded picture, full-bleed: cover-cropped, dimmed, with a dark vignette and a darker band
 * behind the headline + board so the text stays readable on any photo.
 */
const CoverBackground: React.FC<{ image: string }> = ({ image }) => (
  <AbsoluteFill style={{ background: "#07070c" }}>
    <Img src={staticFile(image)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
    <AbsoluteFill style={{ background: "rgba(0,0,0,0.38)" }} />
    <AbsoluteFill style={{ background: "radial-gradient(ellipse 85% 60% at 50% 48%, transparent 25%, rgba(0,0,0,0.75) 100%)" }} />
    <AbsoluteFill style={{ background: "linear-gradient(180deg, transparent 18%, rgba(0,0,0,0.45) 32%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,0.45) 68%, transparent 82%)" }} />
  </AbsoluteFill>
);

const PanelBackground: React.FC<{ image: string }> = ({ image }) => (
  <AbsoluteFill style={{ background: "#050608" }}>
    {PANEL_ROWS.map((row, r) => {
      const top = row.band[0] * DESIGN_HEIGHT;
      const height = (row.band[1] - row.band[0]) * DESIGN_HEIGHT;
      return (
        <div
          key={r}
          style={{ position: "absolute", left: 0, right: 0, top, height, overflow: "hidden", WebkitMaskImage: row.fade, maskImage: row.fade }}
        >
          <Img
            src={staticFile(image)}
            style={{ position: "absolute", left: 0, top: -top + row.shift * DESIGN_HEIGHT, width: DESIGN_WIDTH, height: DESIGN_HEIGHT, objectFit: "cover" }}
          />
          {/* slight dim + a soft inner shadow so each panel reads as its own card */}
          <AbsoluteFill style={{ background: `rgba(0,0,0,${row.dim})` }} />
          {[0, ...row.dividers].map((x, i) => {
            const next = row.dividers[i] ?? 1;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: `calc(${x * 100}% + ${i ? PANEL_GAP / 2 : 0}px)`,
                  width: `calc(${(next - x) * 100}% - ${(i ? PANEL_GAP / 2 : 0) + (next < 1 ? PANEL_GAP / 2 : 0)}px)`,
                  boxShadow: "inset 0 0 90px rgba(0,0,0,0.7)",
                }}
              />
            );
          })}
          {row.dividers.map((x) => (
            <div key={x} style={{ position: "absolute", top: 0, bottom: 0, left: `${x * 100}%`, width: PANEL_GAP, marginLeft: -PANEL_GAP / 2, background: "#050608" }} />
          ))}
        </div>
      );
    })}
    {/* soft cool glow behind the headline */}
    <AbsoluteFill style={{ background: "radial-gradient(ellipse 45% 17% at 50% 53%, rgba(120,140,190,0.2), transparent 75%)" }} />
  </AbsoluteFill>
);

/**
 * Custom thumbnail: category tag, the hook as a giant headline, then the board with
 * only the pre-filled letters showing (a faint "?" in every other slot).
 * Laid out on the 2160×3840 design canvas and scaled to the composition size.
 * Everything sits in the middle band, so a centre crop in the Shorts shelf keeps it.
 */
export const HangmanThumbnail: React.FC<ThumbnailProps> = (props) => {
  const { width, height } = useVideoConfig();
  const scale = Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT);
  const theme = getTheme(props.themeId);
  return (
    <AbsoluteFill style={{ backgroundColor: theme.wood[2], overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: DESIGN_WIDTH, height: DESIGN_HEIGHT, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
        <ThumbnailStage {...props} />
      </div>
    </AbsoluteFill>
  );
};

/** Which part of the card to draw: both (the thumbnail), or just the background / the text + board (ColdOpen animates them apart). */
export type ThumbnailLayer = "all" | "background" | "content";

/** The thumbnail layout on the 2160×3840 design canvas. Also test B's frame 1 in the reel (ColdOpen), without a picture. */
export const ThumbnailCard: React.FC<ThumbnailProps & { layer?: ThumbnailLayer }> = (props) => <ThumbnailStage {...props} />;

const ThumbnailStage: React.FC<ThumbnailProps & { layer?: ThumbnailLayer }> = ({
  hookText,
  word: rawWord,
  hintLetter,
  secondLetter = "",
  themeId,
  category,
  backgroundImage,
  layer = "all",
}) => {
  const theme = getTheme(themeId);
  const word = normalizeWord(rawWord) || "GUESS";
  const hint = resolveHintLetter(word, hintLetter);
  // Lit on the board: the hint + the second pre-filled letter, exactly as on the reel's frame 0.
  const shown = new Set([hint, secondLetter.toUpperCase()].filter(Boolean));
  const headline = (hookText.trim() || "CAN YOU GUESS IT?").toUpperCase();
  const size = headlineSize(headline);
  const letters = word.replace(/ /g, "").length;
  const dark = theme.mode === "dark";
  const outline = dark ? "#050505" : "#fff8ec";

  // Board: one row if it fits, tiles as big as possible (max 260).
  const tile = Math.min(300, Math.floor((SAFE_WIDTH - 80) / (word.length * 1.14)));
  const gap = Math.round(tile * 0.14);

  return (
    <AbsoluteFill>
      {layer !== "content" &&
        (backgroundImage ? (
        <>
          {backgroundImage === CHARACTERS_PICTURE ? (
            <PanelBackground image={backgroundImage} />
          ) : backgroundImage.startsWith(UPLOADS_DIR) ? (
            <CoverBackground image={backgroundImage} />
          ) : (
            <FullBleedBackground image={backgroundImage} />
          )}
        </>
      ) : (
        <>
          <Background theme={theme} />
          {/* darken the edges so the type pops */}
          <AbsoluteFill style={{ background: `radial-gradient(ellipse 85% 60% at 50% 48%, transparent 30%, ${shadeA(theme, 0.85)} 100%)` }} />
        </>
      ))}

      {layer !== "background" && (
      <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 150, padding: "0 140px" }}>
        {category?.trim() && (
          <div
            style={{
              fontFamily: BODY_FONT,
              fontWeight: 900,
              fontSize: 96,
              letterSpacing: "0.12em",
              padding: "22px 60px",
              borderRadius: 999,
              color: theme.onAccent,
              background: theme.accent,
              boxShadow: `0 0 60px ${theme.accent}99, 0 16px 30px ${shadeA(theme, 0.6)}`,
              whiteSpace: "nowrap",
            }}
          >
            {category.trim().toUpperCase()}
          </div>
        )}

        <div
          style={{
            fontFamily: DISPLAY_FONT,
            fontSize: size,
            lineHeight: 1.02,
            letterSpacing: "0.02em",
            textAlign: "center",
            textWrap: "balance",
            maxWidth: HEADLINE_WIDTH,
            color: theme.text,
            WebkitTextStroke: `${Math.round(size * 0.045)}px ${outline}`,
            paintOrder: "stroke fill",
            // dark drop for depth, then a neon accent glow around the letters
            textShadow: `0 ${Math.round(size * 0.05)}px 0 ${outline}, 0 0 ${Math.round(size * 0.14)}px ${theme.accent}cc, 0 0 ${Math.round(size * 0.35)}px ${theme.accent}66`,
          }}
        >
          {headline.split(" ").map((w, i) => (
            <React.Fragment key={i}>
              {i > 0 && " "}
              <span style={{ color: EMPHASIS.test(w.replace(/[^A-Z0-9%]/g, "")) ? theme.accent : undefined }}>{w}</span>
            </React.Fragment>
          ))}
        </div>

        <div style={{ position: "relative", display: "flex", gap, alignItems: "center", justifyContent: "center" }}>
          {[...word].map((ch, i) =>
            ch === " " ? (
              <div key={i} style={{ width: tile * 0.5 }} />
            ) : (
              <div
                key={i}
                style={{
                  position: "relative",
                  width: tile,
                  height: tile * 1.3,
                  borderRadius: tile * 0.14,
                  background: theme.slotBg,
                  border: `${Math.max(5, Math.round(tile * 0.035))}px solid ${shown.has(ch) ? theme.accent : `rgba(${theme.emptyRgb},0.6)`}`,
                  boxShadow: shown.has(ch) ? `0 0 ${tile * 0.5}px ${theme.accent}88, inset 0 0 ${tile * 0.3}px ${theme.accent}44` : `0 10px 24px ${shadeA(theme, 0.6)}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {shown.has(ch) ? (
                  <span
                    style={{
                      fontFamily: DISPLAY_FONT,
                      fontSize: tile * 1.02,
                      lineHeight: 1,
                      color: theme.accent,
                      textShadow: `0 0 ${tile * 0.15 * theme.glow}px ${theme.accent}, 0 0 ${tile * 0.4 * theme.glow}px ${theme.accent}99`,
                    }}
                  >
                    {ch}
                  </span>
                ) : (
                  // faint "?" in every slot still to guess
                  <span style={{ fontFamily: DISPLAY_FONT, fontSize: tile * 0.8, lineHeight: 1, color: theme.accent, opacity: 0.28 }}>?</span>
                )}
              </div>
            ),
          )}
        </div>

        <div
          style={{
            fontFamily: BODY_FONT,
            fontWeight: 900,
            fontSize: 110,
            letterSpacing: "0.1em",
            color: theme.text,
            textShadow: `0 6px 18px ${shadeA(theme, 0.9)}`,
          }}
        >
          {letters} LETTERS · <span style={{ color: theme.accent }}>30 SECONDS</span>
        </div>
      </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
