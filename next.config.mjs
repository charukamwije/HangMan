/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remotion's bundler/renderer ship native binaries + webpack/esbuild — they must
  // run as plain Node modules, never be bundled into the Next.js server build.
  serverExternalPackages: [
    "@remotion/bundler",
    "@remotion/renderer",
    "@remotion/cli",
    "@remotion/compositor-win32-x64-msvc",
    "@remotion/compositor-darwin-arm64",
    "@remotion/compositor-darwin-x64",
    "@remotion/compositor-linux-x64-gnu",
    "@remotion/compositor-linux-x64-musl",
    "@remotion/compositor-linux-arm64-gnu",
    "@remotion/compositor-linux-arm64-musl",
    "esbuild",
  ],
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
