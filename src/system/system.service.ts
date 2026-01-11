import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SystemService implements OnModuleInit {
    constructor(private prisma: PrismaService) { }

    private cachedStatus: boolean = false;
    private lastCheckTime: number = 0;
    private readonly CACHE_TTL = 30000; // 30 seconds cache

    async onModuleInit() {
        try {
            // Ensure at least one config document exists
            const count = await this.prisma.systemConfig.count();

            if (count === 0) {
                await this.prisma.systemConfig.create({
                    data: {
                        isMaintenanceMode: false,
                    }
                });
                console.log('Initialized SystemConfig');
            }
        } catch (error) {
            console.error('Failed to initialize SystemService. Check database connection and credentials.');
            console.error(error);
        }
    }

    async getStatus() {
        const now = Date.now();
        // Use cached value if within TTL
        if (now - this.lastCheckTime < this.CACHE_TTL) {
            return {
                maintenance: this.cachedStatus,
            };
        }

        try {
            const config = await this.prisma.systemConfig.findFirst();
            if (config) {
                this.cachedStatus = config.isMaintenanceMode;
            }
            this.lastCheckTime = now;
        } catch (error) {
            console.error('Error fetching system status, returning cached value:', error);
            // In case of DB error, we return the last known status to prevent crashing the request
        }

        return {
            maintenance: this.cachedStatus,
        };
    }

    async updateStatus(targetStatus?: boolean) {
        let newStatus: boolean;

        // Force refresh to get latest state before update
        const currentConfig = await this.prisma.systemConfig.findFirst();

        if (targetStatus !== undefined) {
            newStatus = targetStatus;
        } else {
            // Toggle
            const currentStatus = currentConfig?.isMaintenanceMode ?? false;
            newStatus = !currentStatus;
        }

        // Update
        // We assume there's only one config, but we update all just in case or update the first found
        if (currentConfig) {
            await this.prisma.systemConfig.update({
                where: { id: currentConfig.id },
                data: { isMaintenanceMode: newStatus }
            });
        } else {
            // Should not happen if onModuleInit worked, but handle safe
            await this.prisma.systemConfig.create({
                data: { isMaintenanceMode: newStatus }
            });
        }

        // Update cache
        this.cachedStatus = newStatus;
        this.lastCheckTime = Date.now();

        return {
            status: 'ok',
            message: `System maintenance mode set to ${newStatus}`,
            maintenance: newStatus,
        };
    }
}
