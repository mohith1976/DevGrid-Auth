import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProposalsController } from './proposals.controller';
import { PublicProposalsController } from './public-proposals.controller';
import { ProjectsService } from './projects.service';
import { ProposalsService } from './proposals.service';
import { MongoService } from '../mongo/mongo.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ProjectsController, ProposalsController, PublicProposalsController],
  providers: [ProjectsService, MongoService, ProposalsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
