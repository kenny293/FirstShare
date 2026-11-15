import type { NextConfig } from "next";

// Level pages are statically generated at build time; price JSON from /data
// is read on the server and passed to the client as weekly series.
const nextConfig: NextConfig = {
  // Lets a second dev server (e.g. against the Firebase emulators) run without clashing.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  serverExternalPackages: ["firebase-admin"],
};

export default nextConfig;
