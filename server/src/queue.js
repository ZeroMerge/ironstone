import { config } from './config.js';

/**
 * Simple FIFO in-memory job queue with a global concurrency cap.
 * No Redis, no persistence — jobs are transient render work.
 */
export function createQueue(worker) {
  const pending = [];
  let running = 0;

  async function pump() {
    while (running < config.maxConcurrentExports && pending.length > 0) {
      const job = pending.shift();
      running += 1;
      worker(job)
        .catch(() => {
          /* worker records its own failures on the job */
        })
        .finally(() => {
          running -= 1;
          pump();
        });
    }
  }

  return {
    push(job) {
      pending.push(job);
      pump();
    },
    positionOf(jobId) {
      const idx = pending.findIndex((j) => j.id === jobId);
      return idx === -1 ? null : idx + 1;
    },
    get size() {
      return pending.length;
    },
  };
}
