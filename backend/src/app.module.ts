import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ProjectsModule } from './projects/projects.module';


@Module({
  imports: [PrismaModule, AuthModule, ProjectsModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
