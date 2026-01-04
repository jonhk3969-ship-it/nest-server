import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SystemService implements OnModuleInit {
    constructor(private prisma: PrismaService) { }

    async onModuleInit() {
        // Ensure at least one config document exists using raw command
        const configs: any = await this.prisma.$runCommandRaw({
            find: 'SystemConfig',
            filter: {},
            limit: 1
        });

        const firstBatch = configs?.cursor?.firstBatch || [];

        if (firstBatch.length === 0) {
            await this.prisma.$runCommandRaw({
                insert: 'SystemConfig',
                documents: [{
                    isMaintenanceMode: false,
                    updatedAt: { $date: new Date().toISOString() }
                }]
            });
        }
    }

    async getStatus() {
        const result: any = await this.prisma.$runCommandRaw({
            find: 'SystemConfig',
            filter: {},
            limit: 1
        });

        const firstBatch = result?.cursor?.firstBatch || [];
        const config = firstBatch[0];

        return {
            maintenance: config?.isMaintenanceMode ?? false,
        };
    }

    async updateStatus(targetStatus?: boolean) {
        let newStatus: boolean;

        if (targetStatus !== undefined) {
            newStatus = targetStatus;
        } else {
            // 1. Get current status and toggle
            const currentStatus = await this.getStatus();
            newStatus = !currentStatus.maintenance;
        }

        const timestamp = new Date().toISOString();

        // 2. Update to new status
        await this.prisma.$runCommandRaw({
            update: 'SystemConfig',
            updates: [
                {
                    q: {},
                    u: { $set: { isMaintenanceMode: newStatus, updatedAt: { $date: timestamp } } },
                    multi: true
                }
            ]
        });

        return {
            status: 'ok',
            message: `System maintenance mode set to ${newStatus}`,
            maintenance: newStatus,
        };
    }
}
