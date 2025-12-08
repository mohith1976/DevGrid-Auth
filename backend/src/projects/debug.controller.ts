import { Controller, Get, Post, Body } from '@nestjs/common';
import { pingRedis, addLanguageJob } from '../queues/languageQueue';

@Controller('api/debug')
export class DebugController {
  @Get('health')
  async health() {
    const out: any = { ok: true, uptime: process.uptime() };
    try {
      const p = await pingRedis();
      out.redis = !!p;
      out.redisPing = p;
    } catch (e: any) {
      out.redis = false;
      out.error = e?.message || String(e);
    }
    return out;
  }

  @Post('enqueue-language-job')
  async enqueueLanguage(@Body() body: any) {
    const userId = body?.userId;
    if (!userId) return { success: false, message: 'Missing userId' };
    try {
      const job = await addLanguageJob(userId);
      return { success: true, jobId: job?.id };
    } catch (e: any) {
      return { success: false, message: e?.message || String(e) };
    }
  }
}
