// Redis/Bull language queue removed.
// Previously this module provided a background queue for language aggregation.
// Keep a minimal stub API so other modules importing it do not fail.

export function initLanguageQueue(_projectsService: any) {
  // No-op: queue removed
  return null;
}

export function addLanguageJob(_userId: string) {
  throw new Error('Language aggregation queue is disabled (Redis removed)');
}

export function getLanguageQueue() { return null; }

export function getQueueConnection() { return null; }

export async function pingRedis() { return null; }
