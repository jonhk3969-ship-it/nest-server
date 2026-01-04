import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { SystemService } from '../system/system.service';
import { RolePermissions } from './permissions';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class AuthService {


    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService,
        private systemService: SystemService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
    ) { }

    async validateAdmin(username: string, pass: string): Promise<any> {
        const user: any = await this.prisma.admin.findUnique({ where: { username } });
        if (user && await bcrypt.compare(pass, user.password)) {
            if (user.status === false) {
                throw new UnauthorizedException('ບັນຊີຖືກບລັອກ');
            }
            const { password, ...result } = user;
            return result;
        }
        return null;
    }

    async validateAgent(username: string, pass: string): Promise<any> {
        const user: any = await this.prisma.agent.findUnique({ where: { username } });
        if (user && await bcrypt.compare(pass, user.password)) {
            if (user.status === false) {
                throw new UnauthorizedException('ບັນຊີຖືກບລັອກ');
            }
            const { password, ...result } = user;
            return result;
        }
        return null;
    }

    async validateUserClient(username: string, pass: string): Promise<any> {
        const user: any = await this.prisma.user.findUnique({ where: { username } });
        if (user && await bcrypt.compare(pass, user.password)) {
            if (user.status === false) {
                throw new UnauthorizedException('ບັນຊີຖືກບລັອກ');
            }
            const { password, ...result } = user;
            return result;
        }
        return null;
    }

    async login(user: any, ip?: string) {
        // Check Maintenance Mode
        const systemStatus = await this.systemService.getStatus();
        if (systemStatus.maintenance && user.role !== 'ADMIN') {
            throw new UnauthorizedException('System is in maintenance mode');
        }

        if (user.role === 'USER') {
            const updates: any = {
                isOnline: true,
                updatedAt: { $date: new Date().toISOString() }
            };

            if (ip) {
                updates.ip = ip;
            }

            await this.prisma.$runCommandRaw({
                update: 'User',
                updates: [
                    {
                        q: { _id: { $oid: user.id } },
                        u: {
                            $set: updates
                        }
                    }
                ]
            });
            // Update local object to reflect change in response
            user.isOnline = true;
            if (ip) user.ip = ip;
        }

        // 3. Normalized Response & Minimal Payload
        // Security: Add 'type' to prevent ID collision attacks
        // This ensures JwtStrategy queries the correct table directly
        let entityType: 'admin' | 'agent' | 'user' = 'user';

        if (user.role === 'ADMIN') {
            entityType = 'admin';
        } else if (user.role === 'AGENT') {
            entityType = 'agent';
        } else if (user.role === 'USER') {
            entityType = 'user';
        }

        const payload = {
            sub: user.id,
            type: entityType  // Security: Prevents ID collision, enables targeted DB lookup
        };

        // CACHE OPTIMIZATION: Store user essential data in Redis
        // TTL: 60 minutes (3600s) + Jitter (0-300s) to prevent thundering herd
        const jitter = Math.floor(Math.random() * 300);
        const ttl = 3600 + jitter;

        const cacheKey = `auth_user:${user.id}`;
        const cacheValue = {
            userId: user.id,
            username: user.username,
            role: entityType,
            status: true, // We successfully logged in, so status is valid
            agentId: user.agentId ? user.agentId.toString() : null, // Store agentId if user
            // Optimization: We could store agentStatus here too, but for simplicity/freshness 
            // the strategy might still verify if needed, OR we trust it for 1 hour.
            // For 100k users, WE MUST TRUST CACHE.
        };

        await this.cacheManager.set(cacheKey, cacheValue, ttl);

        return {
            status: 'ok',
            code: 201,
            message: 'Success',
            data: {
                access_token: this.jwtService.sign(payload)
            }
        };
    }
    async hashPassword(password: string) {
        return bcrypt.hash(password, 10);
    }

    getMe(user: any) {
        const role = user.role.toLowerCase();
        const permissions = RolePermissions[role] || [];

        return {
            id: user.userId, // mapped from userId in strategy return
            username: user.username,
            role: user.role.toUpperCase(), // Normalize to uppercase as requested
            permissions: permissions
        };
    }


}
