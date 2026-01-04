
import { Global, Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as redisStore from 'cache-manager-redis-store';

@Global()
@Module({
    imports: [
        CacheModule.registerAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => ({
                store: redisStore,
                host: configService.get('REDIS_HOST') || 'localhost',
                port: configService.get('REDIS_PORT') || 6379,
                ttl: 3600, // Default TTL 1 hour
            }),
            inject: [ConfigService],
        }),
    ],
    exports: [CacheModule],
})
export class RedisModule { }
