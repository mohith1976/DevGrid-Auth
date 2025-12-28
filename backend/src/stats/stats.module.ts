import { Module } from '@nestjs/common';
import { StatsController, StatsService } from './index';
import { GitHubDataService } from './github-data.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  controllers: [StatsController],
  providers: [StatsService, GitHubDataService],
  imports: [AuthModule],
})
export class StatsModule {}
