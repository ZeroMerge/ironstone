import { config } from './config.js';

/**
 * In-memory per-IP daily export counters, reset at local midnight.
 * Stateless by design — a restart simply resets the budget, which is fine
 * for a free tier with no user accounts.
 */
const counters = new Map(); // ip -> { count, resetAt }

function midnightResetAt() {
  const d = new Date();
  d.setHours(24, 0, 0, 0);
  return d.getTime();
}

export function checkAndIncrement(ip) {
  const now = Date.now();
  let entry = counters.get(ip);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: midnightResetAt() };
    counters.set(ip, entry);
  }
  if (entry.count >= config.maxExportsPerIpPerDay) {
    return { allowed: false, remaining: 0 };
  }
  entry.count += 1;
  return { allowed: true, remaining: config.maxExportsPerIpPerDay - entry.count };
}

// Housekeeping so the map doesn't grow forever.
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of counters) {
    if (now >= entry.resetAt) counters.delete(ip);
  }
}, 60 * 60 * 1000).unref();
