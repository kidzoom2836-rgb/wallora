// WALLORA background worker entry point.
// Heavy AI tasks and image processing run here, not in Vercel request handlers.

import "dotenv/config";

async function main() {
  console.log("[worker] WALLORA worker starting...");
  // Job queue bootstrap will be added in later phases.
  console.log("[worker] Ready. Waiting for jobs.");
}

main().catch((err) => {
  console.error("[worker] Fatal error", err);
  process.exit(1);
});
