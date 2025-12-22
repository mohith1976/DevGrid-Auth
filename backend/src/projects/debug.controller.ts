import { Controller, Get } from '@nestjs/common';

@Controller('api/debug')
export class DebugController {
  @Get('health')
  async health() {
    return { ok: true, uptime: process.uptime() };
  }
}
