import { Controller, Get, Param, Header } from '@nestjs/common';
import { StatsService } from './stats.service';

@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get(':username')
  @Header('Content-Type', 'image/svg+xml; charset=utf-8')
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
  async getSvg(@Param('username') username: string) {
    return this.statsService.getSvgForUser(username);
  }

  @Get(':username.svg')
  @Header('Content-Type', 'image/svg+xml; charset=utf-8')
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
  async getSvgDot(@Param('username') username: string) {
    return this.statsService.getSvgForUser(username);
  }
}
