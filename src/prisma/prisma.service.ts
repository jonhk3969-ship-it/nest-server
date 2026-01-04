import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    async onModuleInit() {
        console.log('--- PRISMA DEBUG ---');
        const url = process.env.DATABASE_URL;
        console.log('DATABASE_URL exists:', !!url);
        if (url) {
            console.log('DATABASE_URL value (masked):', url.replace(/:([^:@]+)@/, ':****@'));
        }
        await this.$connect();
    }

    async onModuleDestroy() {
        await this.$disconnect();
    }
}
