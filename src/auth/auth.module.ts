import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { PrismaModule } from '../prisma/prisma.module';
import { SystemModule } from '../system/system.module';

import { RedisModule } from '../common/redis/redis.module';

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    RedisModule, // Import Global Redis Module
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('FATAL: JWT_SECRET environment variable is not defined. Application cannot start without a secure JWT secret.');
        }
        return {
          secret,
          signOptions: { expiresIn: '60m' }, // Access token lasts 60m per requirement
        };
      },
      inject: [ConfigService],
    }),
    SystemModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule { }
