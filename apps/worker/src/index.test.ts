import { describe, expect, it, vi } from "vitest";
import { startWorker, type WorkerLogger } from "./index";

function makeLogger(): WorkerLogger {
  return { info: vi.fn(), error: vi.fn() };
}

describe("worker bootstrap", () => {
  it("reports startup and readiness through the provided logger", async () => {
    const logger = makeLogger();

    await startWorker(logger);

    expect(logger.info).toHaveBeenCalledWith(
      "[worker] WALLORA worker starting...",
    );
    expect(logger.info).toHaveBeenCalledWith(
      "[worker] Ready. Waiting for jobs.",
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("does not require a real environment to start", async () => {
    const logger = makeLogger();

    await expect(startWorker(logger)).resolves.toBeUndefined();
  });
});
