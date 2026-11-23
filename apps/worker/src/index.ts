// WALLORA background worker entry point.
// Heavy AI tasks and image processing run here, not in Vercel request handlers.

import "dotenv/config";

export interface WorkerLogger {
  info: (message: string) => void;
  error: (message: string, error?: unknown) => void;
}

const defaultLogger: WorkerLogger = {
  info: (message) => console.log(message),
  error: (message, error) => console.error(message, error ?? ""),
};

export async function startWorker(
  logger: WorkerLogger = defaultLogger,
): Promise<void> {
  logger.info("[worker] WALLORA worker starting...");
  // Job queue bootstrap will be added in later phases.
  logger.info("[worker] Ready. Waiting for jobs.");
}

if (process.env.NODE_ENV !== "test") {
  startWorker().catch((error) => {
    defaultLogger.error("[worker] Fatal error", error);
    process.exit(1);
  });
}
