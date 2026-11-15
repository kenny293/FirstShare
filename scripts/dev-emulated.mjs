// Run the app against the local Firebase emulators (start them first with `npm run emulators`).
// Usage: npm run dev:emulated [-- --port 3001]
import { spawn } from "node:child_process";

const env = {
  ...process.env,
  NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "1",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-firstshare",
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  GCLOUD_PROJECT: "demo-firstshare",
  NEXT_DIST_DIR: process.env.NEXT_DIST_DIR || ".next-emulated",
};
const child = spawn("npx", ["next", "dev", ...process.argv.slice(2)], { env, stdio: "inherit", shell: true });
child.on("exit", (code) => process.exit(code ?? 0));
