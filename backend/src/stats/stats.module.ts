import { Module } from '@nestjs/common';
import { StatsController, StatsService } from './index';

@Module({
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
