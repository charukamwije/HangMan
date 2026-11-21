/**
 * Virtual camera "shots". A single-stage puzzle has no B-roll, so the scene
 * change every 1–2 s comes from reframing the stage itself:
 *
 *   impact G           hard CUT to a close-up: the word board on a correct letter,
 *                      the pawn row + top of the keys on a miss
 *   G + HOLD           ease back to the WIDE shot over EASE frames
 *                      (earlier if the next guess is closer)
 *   stress (00:07 →)   close-ups go a few % tighter
 *   loop               WIDE from loopResetStart − 0.3 s, so the reset and frame 0 match
 *
 * Shots start after the opening hook only (it has its own camera). Every shot
 * returns to scale 1 before the next one cuts in, so switching the origin
 * between shots is never visible. Pure: no React / remotion import.
 */
import { DESIGN_WIDTH, LOWER_SAFE_CENTER_X, SAFE_WIDTH } from "./constants";
import { stressStartFrame, type Timeline } from "./timeline";

export type Shot = { from: number; holdTo: number; to: number; scale: number; originX: number; originY: number };
export type CameraLayout = {
  /** Word board centre (design px). */
  wordCenterY: number;
  /** Widest board line incl. slot spacing (design px). */
  boardWidth: number;
  /** Pawn row centre (design px). */
  livesCenterY: number;
  loopResetStart: number;
};

const CLOSE_CORRECT = 1.15;
const CLOSE_WRONG = 1.08;
const STRESS_TIGHTEN = 0.04;
const HOLD_SECONDS = 0.95;
const EASE_SECONDS = 0.27;
/** Close-ups never push the board past the side crop (margin + headroom for the 3.5 % correct punch-in). */
const BOARD_MARGIN = 60;
const PUNCH_HEADROOM = 1.04;

export function cameraShots(
  timeline: Pick<Timeline, "guesses" | "hook" | "tickFrames" | "finalRevealFrame">,
  layout: CameraLayout,
  fps: number,
): Shot[] {
  const stressFrom = stressStartFrame(timeline.tickFrames) ?? Infinity;
  const wideFrom = layout.loopResetStart - Math.round(0.3 * fps);
  const ease = Math.round(EASE_SECONDS * fps);
  const boardFit = (SAFE_WIDTH - BOARD_MARGIN) / (Math.max(1, layout.boardWidth) * PUNCH_HEADROOM);
  const shown = timeline.guesses.filter((g) => g.frame >= timeline.hook.endFrame && g.frame < timeline.finalRevealFrame);
  const shots: Shot[] = [];
  shown.forEach((g, i) => {
    const next = i + 1 < shown.length ? shown[i + 1].frame : Infinity;
    const to = Math.min(g.frame + Math.round(HOLD_SECONDS * fps) + ease, next - 1, wideFrom);
    if (to - g.frame < ease) return; // no room for a shot (too close to the next beat or the loop)
    const tight = g.frame >= stressFrom ? STRESS_TIGHTEN : 0;
    const correct = g.kind === "correct";
    const scale = correct ? Math.max(1, Math.min(CLOSE_CORRECT + tight, boardFit)) : CLOSE_WRONG + tight;
    // Misses scale about the key box's own centre (it sits left of the platform action rail), so it grows evenly.
    shots.push({ from: g.frame, holdTo: to - ease, to, scale, originX: correct ? DESIGN_WIDTH / 2 : LOWER_SAFE_CENTER_X, originY: correct ? layout.wordCenterY : layout.livesCenterY });
  });
  return shots;
}

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Camera scale + origin at `frame` (scale 1 = the wide shot). */
export function shotAt(shots: readonly Shot[], frame: number, fallbackOriginY: number): { scale: number; originX: number; originY: number } {
  for (const s of shots) {
    if (frame < s.from || frame >= s.to) continue;
    const back = frame < s.holdTo ? 0 : easeInOutCubic(Math.min(1, (frame - s.holdTo + 1) / (s.to - s.holdTo)));
    return { scale: 1 + (s.scale - 1) * (1 - back), originX: s.originX, originY: s.originY };
  }
  return { scale: 1, originX: DESIGN_WIDTH / 2, originY: fallbackOriginY };
}
