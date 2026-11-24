import { z } from "zod";
import { DEFAULT_HOOK_TEXT, DURATION_SECONDS } from "@/remotion/constants";
import { THEME_IDS, type ThemeId } from "@/remotion/themes";

/** Server-side validation of composition input props (API route + CLI props files). */
export const reelPropsSchema = z.object({
  // Defaults keep older props files (pre-hook) valid.
  hookText: z.string().max(60).default(DEFAULT_HOOK_TEXT),
  hintLetter: z.string().regex(/^[A-Za-z]?$/, "One letter or empty").default(""),
  secondLetter: z.string().regex(/^[A-Za-z]{0,2}$/, "Up to two letters").optional(),
  subtitle: z.string().max(120),
  hint2: z.string().max(120).default(""),
  questionLine: z.string().max(80).optional(),
  challenge: z.string().max(30).optional(),
  word: z
    .string()
    .min(1)
    .max(36)
    .regex(/^[A-Za-z ]+$/, "Only letters and spaces"),
  guesses: z
    .array(z.object({ letter: z.string().regex(/^[A-Za-z]$/), time: z.number().min(0).max(DURATION_SECONDS) }))
    .max(26),
  finalRevealAt: z.number().min(1).max(DURATION_SECONDS),
  themeId: z.enum(THEME_IDS as [ThemeId, ...ThemeId[]]),
  audio: z.object({
    enabled: z.boolean(),
    music: z.number().min(0).max(1),
    tick: z.number().min(0).max(1),
    sfx: z.number().min(0).max(1),
  }),
  showSafeZones: z.boolean(),
  durationSeconds: z.number().int().min(10).max(DURATION_SECONDS).optional(),
  backgroundImage: z.string().regex(/^[A-Za-z0-9_\-/.]*$/).refine((p) => !p.includes(".."), "Invalid path").optional(),
});

export type ReelPropsInput = z.infer<typeof reelPropsSchema>;
