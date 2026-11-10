import { z } from "zod";
import { DEFAULT_HOOK_TEXT, DURATION_SECONDS } from "@/remotion/constants";
import { THEME_IDS, type ThemeId } from "@/remotion/themes";

/** Server-side validation of composition input props (API route + CLI props files). */
export const reelPropsSchema = z.object({
  // Defaults keep older props files (pre-hook) valid.
  hookText: z.string().max(40).default(DEFAULT_HOOK_TEXT),
  hintLetter: z.string().regex(/^[A-Za-z]?$/, "One letter or empty").default(""),
  category: z.string().max(80),
  subtitle: z.string().max(120),
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
});

export type ReelPropsInput = z.infer<typeof reelPropsSchema>;
