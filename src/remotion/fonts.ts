import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

// Loaded once at module scope; Remotion delays rendering until the fonts are ready.
export const { fontFamily: DISPLAY_FONT } = loadAnton("normal", { weights: ["400"], subsets: ["latin"] });
export const { fontFamily: BODY_FONT } = loadInter("normal", { weights: ["600", "800", "900"], subsets: ["latin"] });
