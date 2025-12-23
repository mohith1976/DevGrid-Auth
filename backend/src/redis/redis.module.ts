import { Global, Module } from '@nestjs/common';
import { RedisService } from './index';

@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
