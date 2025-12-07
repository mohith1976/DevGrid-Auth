import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProposalsController } from './proposals.controller';
import { PublicProposalsController } from './public-proposals.controller';
import { TeamsController } from './teams.controller';
import { AchievementsController } from './achievements.controller';
import { CertificationsController } from './certifications.controller';
import { ProjectsService } from './projects.service';
import { ProposalsService } from './proposals.service';
import { AchievementsService } from './achievements.service';
import { CertificationsService } from './certifications.service';
import { MongoService } from '../mongo/mongo.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ProjectsController, ProposalsController, PublicProposalsController, TeamsController, AchievementsController, CertificationsController],
  providers: [ProjectsService, MongoService, ProposalsService, AchievementsService, CertificationsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
