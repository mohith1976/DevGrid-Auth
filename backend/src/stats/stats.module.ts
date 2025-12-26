import { Module } from '@nestjs/common';
import { StatsController, StatsService } from './index';
import { GitHubDataService } from './github-data.service';

@Module({
  controllers: [StatsController],
  providers: [StatsService, GitHubDataService],
})
export class StatsModule {}
