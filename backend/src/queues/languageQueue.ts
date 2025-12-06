import Queue from 'bull';

let langQueue: any = null;

export function initLanguageQueue(projectsService: any) {
  if (langQueue) return langQueue;
  const redisUrl = process.env.REDIS_URL || process.env.REDIS || 'redis://127.0.0.1:6379';
  langQueue = new Queue('language-agg', redisUrl);

  langQueue.process(async (job: any) => {
    const userId = job.data?.userId;
    if (!userId) throw new Error('Missing userId for language aggregation job');
    try {
      console.log(`[language-agg] processing user ${userId}`);
      await projectsService.performAccountLanguageAggregation(userId);
      console.log(`[language-agg] completed user ${userId}`);
    } catch (e: any) {
      console.error('[language-agg] job failed', e?.message || e);
      throw e;
    }
  });

  langQueue.on('failed', (job:any, err:any) => {
    console.warn('[language-agg] job failed', job.id, err?.message || err);
  });

  return langQueue;
}

export function addLanguageJob(userId: string) {
  if (!langQueue) throw new Error('Language queue not initialized');
  return langQueue.add({ userId }, { removeOnComplete: true, attempts: 3, backoff: 5000 });
}
