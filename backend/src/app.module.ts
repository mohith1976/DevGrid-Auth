import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ProjectsModule } from './projects/projects.module';
import { UploadsController } from './uploads/uploads.controller';
import { StatsModule } from './stats/stats.module';


@Module({
  imports: [PrismaModule, AuthModule, ProjectsModule, StatsModule],
  controllers: [UploadsController],
  providers: [],
})
export class AppModule {}
