import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma.service';
import { GitHubTokenService } from './github-token.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, PrismaService, GitHubTokenService],
  exports: [GitHubTokenService],
})
export class AuthModule {}
