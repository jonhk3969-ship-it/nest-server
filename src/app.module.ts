import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerLaoGuard } from './throttler-lao.guard';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AgentsModule } from './agents/agents.module';
import { AdminsModule } from './admins/admins.module';
import { CommonModule } from './common/common.module';
import { PrismaModule } from './prisma/prisma.module';
import { SystemModule } from './system/system.module';
import { MaintenanceGuard } from './common/guards/maintenance.guard';
import { PostsModule } from './posts/posts.module';
import { GamesModule } from './games/games.module';
import { SeamlessModule } from './seamless/seamless.module';
import { ProvidersModule } from './providers/providers.module';
import { BannersModule } from './banners/banners.module';
import { RedisModule } from './common/redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get('REDIS_HOST') || 'localhost',
          port: parseInt(configService.get('REDIS_PORT') || '6379'),
          password: configService.get('REDIS_PASSWORD') || undefined,
        },
      }),
      inject: [ConfigService],
    }),
    ThrottlerModule.forRoot([{
      ttl: 60,
      limit: 10000000, // Increased for Load Test
    }]),
    RedisModule,
    AuthModule,
    UsersModule,
    AgentsModule,
    AdminsModule,
    CommonModule,
    PrismaModule,
    SystemModule,
    PostsModule,
    GamesModule,
    SeamlessModule,
    ProvidersModule,
    BannersModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerLaoGuard,
    },
    {
      provide: APP_GUARD,
      useClass: MaintenanceGuard,
    },
  ],
})
export class AppModule { }
