import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Inject } from '@nestjs/common';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        config: ConfigService,
        private prisma: PrismaService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache
    ) {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret) {
            throw new Error('FATAL: JWT_SECRET environment variable is not defined');
        }
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: secret,
        });
    }

    async validate(payload: any) {
        const id = payload.sub;
        const type = payload.type;
        const cacheKey = `auth_user:${id}`;

        // 1. Try to get from Cache (Fast path)
        const cachedUser: any = await this.cacheManager.get(cacheKey);

        if (cachedUser) {
            // Check structural validity just in case
            if (!cachedUser.status) {
                throw new UnauthorizedException('Account is blocked (cached)');
            }
            return {
                userId: cachedUser.userId,
                username: cachedUser.username,
                role: cachedUser.role
            };
        }

        // 2. Cache Miss - Fallback to Database (Slow path)
        // This only happens if Redis is down or key expired/evicted

        let entity: any;
        let role = '';

        // Direct lookup based on type
        if (type === 'admin') {
            entity = await this.prisma.admin.findUnique({ where: { id } });
            if (entity) role = 'admin';
        } else if (type === 'agent') {
            entity = await this.prisma.agent.findUnique({ where: { id } });
            if (entity) role = 'agent';
        } else if (type === 'user') {
            entity = await this.prisma.user.findUnique({
                where: { id },
                include: { agent: true }
            });
            if (entity) role = 'user';
        } else {
            throw new UnauthorizedException('Invalid token structure');
        }

        // Check if entity exists and is active
        if (!entity || entity.status === false) {
            throw new UnauthorizedException('Account is blocked or does not exist');
        }

        // If User, check if parent Agent is active
        if (role === 'user') {
            if (!entity.agent || entity.agent.status === false) {
                throw new UnauthorizedException('Service suspended (Agent blocked)');
            }
        }

        // 3. Populate Cache for next request
        // We use a safe standard TTL of 3600 (1 hour) to match token
        const cacheValue = {
            userId: id,
            username: entity.username,
            role: role,
            status: true,
            agentId: entity.agentId ? entity.agentId.toString() : null
        };

        await this.cacheManager.set(cacheKey, cacheValue, 3600);

        return { userId: id, username: entity.username, role: role };
    }
}
