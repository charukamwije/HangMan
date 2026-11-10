/**
 * Remotion CLI defaults (used by `npm run render`, `npx remotion render`, Studio).
 * The API route passes the same values programmatically — see src/lib/render-config.ts.
 */
import { Config } from "@remotion/cli/config";

Config.setPublicDir("./public");
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setColorSpace("bt709");
Config.setVideoBitrate("50M"); // high-bitrate 4K60 master (platforms re-encode)
Config.setAudioCodec("aac");
Config.setAudioBitrate("320k");
Config.setConcurrency("50%");
Config.setChromiumOpenGlRenderer("angle");
Config.setOverwriteOutput(true);
