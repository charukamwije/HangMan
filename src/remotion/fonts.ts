import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadCinzel } from "@remotion/google-fonts/Cinzel";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadPermanentMarker } from "@remotion/google-fonts/PermanentMarker";
import { loadFont as loadRoboto } from "@remotion/google-fonts/Roboto";

// Loaded once at module scope; Remotion delays rendering until the fonts are ready.
export const { fontFamily: DISPLAY_FONT } = loadAnton("normal", { weights: ["400"], subsets: ["latin"] });
export const { fontFamily: BODY_FONT } = loadInter("normal", { weights: ["600", "800", "900"], subsets: ["latin"] });
/** Hand-lettered marker for the pawns' speech bubbles. */
export const { fontFamily: HAND_FONT } = loadPermanentMarker("normal", { weights: ["400"], subsets: ["latin"] });
/** YouTube's interface face (Like / Subscribe buttons use Roboto Medium). */
export const { fontFamily: YT_FONT } = loadRoboto("normal", { weights: ["500"], subsets: ["latin"] });
/** Dark Academia serif for the opening-hook decoys. */
export const { fontFamily: HOOK_FONT } = loadCinzel("normal", { weights: ["700", "900"], subsets: ["latin"] });
