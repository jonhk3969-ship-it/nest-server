import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{
      ttl: 60,
      limit: 10,
    }]),
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
