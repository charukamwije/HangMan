import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Theme } from "../themes";
import { DISPLAY_FONT } from "../fonts";
import { framesSinceLast, ramp, strikeShake } from "../motion";
import { SAFE_CENTER_X } from "../constants";

/** 4-row alphabetical A–Z grid: 7 / 7 / 6 / 6. */
export const KEY_ROWS = ["ABCDEFG", "HIJKLMN", "OPQRST", "UVWXYZ"];

const KEY_W = 222;
const KEY_H = 182;
const GAP = 22;
const PAD = 50;

export const KEYBOARD_HEIGHT = KEY_ROWS.length * KEY_H + (KEY_ROWS.length - 1) * GAP + PAD * 2;

type KeyState = "idle" | "correct" | "wrong";

/**
 * The key box. On screen from frame 0 (the hint key is already lit). Every
 * wrong strike kicks the whole box horizontally with a spring (micro-feedback).
 */
export const Keyboard: React.FC<{
  theme: Theme;
  top: number;
  correctKeyFrames: Map<string, number>;
  wrongKeyFrames: Map<string, number>;
  wrongFrames: number[];
  /** Peak horizontal shake on a strike, in design px. */
  shakePx: number;
}> = ({ theme, top, correctKeyFrames, wrongKeyFrames, wrongFrames, shakePx }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const shakeX = strikeShake(framesSinceLast(wrongFrames, frame), fps, shakePx);

  return (
    <div
      style={{
        position: "absolute",
        left: SAFE_CENTER_X, // 1792px box → spans 114–1906, inside the 80–1940 safe band
        top,
        transform: `translateX(calc(-50% + ${shakeX.toFixed(2)}px))`,
        padding: PAD,
        borderRadius: 72,
        background: "linear-gradient(180deg, rgba(18,14,10,0.58), rgba(6,5,4,0.72))",
        backdropFilter: "blur(28px) saturate(1.2)",
        border: "3px solid rgba(255,255,255,0.10)",
        boxShadow: "0 40px 120px rgba(0,0,0,0.75), inset 0 2px 0 rgba(255,255,255,0.06)",
        display: "flex",
        flexDirection: "column",
        gap: GAP,
      }}
    >
      {KEY_ROWS.map((row, r) => (
        <div key={r} style={{ display: "flex", gap: GAP, justifyContent: "center" }}>
          {row.split("").map((letter) => {
            const cf = correctKeyFrames.get(letter);
            const wf = wrongKeyFrames.get(letter);
            const state: KeyState = cf !== undefined && frame >= cf ? "correct" : wf !== undefined && frame >= wf ? "wrong" : "idle";
            const since = state === "correct" ? frame - cf! : state === "wrong" ? frame - wf! : -1;
            return <Key key={letter} letter={letter} state={state} since={since} theme={theme} fps={fps} />;
          })}
        </div>
      ))}
    </div>
  );
};

const Key: React.FC<{ letter: string; state: KeyState; since: number; theme: Theme; fps: number }> = ({ letter, state, since, theme, fps }) => {
  const s = since / fps;
  const press = since >= 0 ? spring({ frame: since, fps, config: { damping: 9, stiffness: 260 } }) : 1;
  // Correct keys pop UP out of the box (1.45×); wrong keys get crushed (0.6×) and rattle.
  const scale = since >= 0 ? interpolate(press, [0, 1], [state === "correct" ? 1.45 : 0.6, 1]) : 1;
  const rattle = state === "wrong" && since >= 0 && since < fps * 0.35 ? Math.sin(since * 2.6) * 14 * (1 - since / (fps * 0.35)) : 0;
  const flash = since >= 0 ? ramp(s, [0, 0.067, 0.5], [0, 1, 0]) : 0;
  // 'X' strike draws itself over ~0.17 s.
  const strike = state === "wrong" ? ramp(s, [0.033, 0.2], [0, 1]) : 0;
  const LEN = 260;

  const base: React.CSSProperties = {
    position: "relative",
    width: KEY_W,
    height: KEY_H,
    borderRadius: 36,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: DISPLAY_FONT,
    fontSize: 118,
    lineHeight: 1,
    transform: `translateX(${rattle.toFixed(2)}px) scale(${scale})`,
    zIndex: since >= 0 && since < fps * 0.5 ? 2 : undefined,
  };

  const styles: Record<KeyState, React.CSSProperties> = {
    idle: {
      background: "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04))",
      border: "3px solid rgba(255,255,255,0.20)",
      color: "#FFFFFF",
      textShadow: "0 4px 12px rgba(0,0,0,0.6)",
    },
    correct: {
      background: theme.accent,
      border: `3px solid ${theme.accent}`,
      color: "#0b0b05",
      boxShadow: `0 0 ${36 + 80 * flash}px ${theme.accent}${flash > 0.1 ? "cc" : "77"}, inset 0 -8px 0 rgba(0,0,0,0.18)`,
    },
    wrong: {
      background: `rgba(255,46,46,${0.12 + 0.35 * flash})`,
      border: `4px solid ${theme.wrong}`,
      color: theme.wrong,
      boxShadow: `0 0 ${20 + 70 * flash}px ${theme.wrong}aa`,
    },
  };

  return (
    <div style={{ ...base, ...styles[state] }}>
      <span style={{ opacity: state === "wrong" ? 0.75 : 1, marginTop: 6 }}>{letter}</span>
      {state === "wrong" && (
        <svg viewBox="0 0 222 182" width={KEY_W} height={KEY_H} style={{ position: "absolute", inset: 0, overflow: "visible", filter: `drop-shadow(0 0 14px ${theme.wrong})` }}>
          <line x1="38" y1="26" x2="184" y2="156" stroke={theme.wrong} strokeWidth="16" strokeLinecap="round" strokeDasharray={LEN} strokeDashoffset={LEN * (1 - Math.min(1, strike * 2))} />
          <line x1="184" y1="26" x2="38" y2="156" stroke={theme.wrong} strokeWidth="16" strokeLinecap="round" strokeDasharray={LEN} strokeDashoffset={LEN * (1 - Math.max(0, strike * 2 - 1))} />
        </svg>
      )}
    </div>
  );
};
