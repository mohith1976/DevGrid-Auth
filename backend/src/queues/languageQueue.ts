import Queue from 'bull';

let langQueue: any = null;
let queueConnUsed: any = null;

export function initLanguageQueue(projectsService: any) {
  if (langQueue) return langQueue;
  const redisUrl = process.env.REDIS_URL || process.env.REDIS || 'redis://127.0.0.1:6379';
  // Support raw URL (including Upstash rediss://) and options object
  let queueConn: any = redisUrl;
  try {
    const parsed = new URL(redisUrl);
    if (parsed.protocol === 'redis:' || parsed.protocol === 'rediss:') {
      const port = parsed.port ? parseInt(parsed.port, 10) : 6379;
      const password = parsed.password ? decodeURIComponent(parsed.password) : undefined;
      const host = parsed.hostname;
      const tls = parsed.protocol === 'rediss:' ? {} : undefined;
      queueConn = { redis: { port, host, password, tls } };
    }
  } catch (e) {
    // If parsing fails, fall back to passing the raw URL string
    queueConn = redisUrl;
  }

  // remember the resolved connection so other helpers can reuse it
  queueConnUsed = queueConn;

  langQueue = new Queue('language-agg', queueConn);

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

  langQueue.on('error', (err:any) => {
    console.error('[language-agg] queue error', err?.message || err);
  });

  langQueue.on('waiting', (jobId: any) => {
    console.log('[language-agg] job waiting', jobId);
  });

  langQueue.on('completed', (job:any, result:any) => {
    console.log('[language-agg] job completed', job.id);
  });

  // expose the underlying ioredis client availability in logs
  try {
    const client = (langQueue && (langQueue.client || (langQueue as any).clients && (langQueue as any).clients.redis));
    if (client) console.log('[language-agg] redis client available for ping/status');
  } catch (e) { /* ignore */ }

  return langQueue;
}

export function addLanguageJob(userId: string) {
  if (!langQueue) throw new Error('Language queue not initialized');
  return langQueue.add({ userId }, { removeOnComplete: true, attempts: 3, backoff: 5000 });
}

export function getLanguageQueue() {
  return langQueue;
}

export function getQueueConnection() {
  return queueConnUsed;
}

export async function pingRedis() {
  if (!langQueue) throw new Error('Language queue not initialized');
  try {
    const client = langQueue.client || (langQueue as any).clients?.redis;
    if (client && typeof client.ping === 'function') {
      return await client.ping();
    }
    // fallback: if queue exposes a .client property not matching expectations
    return null;
  } catch (e:any) {
    throw e;
  }
}
