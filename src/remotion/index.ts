// Remotion entry point — used by the CLI (`remotion render/studio`) and by
// @remotion/bundler in the /api/render route. Keep imports in src/remotion relative.
import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);
