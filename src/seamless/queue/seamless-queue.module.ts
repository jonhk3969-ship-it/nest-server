
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SeamlessService } from '../seamless.service';
import { SeamlessProcessor0, SeamlessProcessor1, SeamlessProcessor2, SeamlessProcessor3 } from '../worker/seamless.processor';
import { SeamlessProducer } from './seamless.producer';
import { PrismaService } from '../../prisma/prisma.service';
import { HistoryProcessor } from '../worker/history.processor';
import { SeamlessWorker } from '../worker/seamless.worker';

@Module({
    imports: [
        BullModule.registerQueue(
            { name: 'bets-0' },
            { name: 'bets-1' },
            { name: 'bets-2' },
            { name: 'bets-3' },
            { name: 'history' }
        ),
    ],
    providers: [
        SeamlessProducer,
        SeamlessProcessor0,
        SeamlessProcessor1,
        SeamlessProcessor2,
        SeamlessProcessor3,
        HistoryProcessor,
        SeamlessService,
        PrismaService,
        SeamlessWorker,
        // Provide QueueEvents for each shard
        {
            provide: 'QueueEvents0',
            useFactory: () => {
                const { QueueEvents } = require('bullmq');
                const qe = new QueueEvents('bets-0', {
                    connection: {
                        host: process.env.REDIS_HOST || 'localhost',
                        port: parseInt(process.env.REDIS_PORT || '6379'),
                        password: process.env.REDIS_PASSWORD || undefined,
                    }
                });
                qe.setMaxListeners(2000);
                return qe;
            }
        },
        {
            provide: 'QueueEvents1',
            useFactory: () => {
                const { QueueEvents } = require('bullmq');
                const qe = new QueueEvents('bets-1', {
                    connection: {
                        host: process.env.REDIS_HOST || 'localhost',
                        port: parseInt(process.env.REDIS_PORT || '6379'),
                        password: process.env.REDIS_PASSWORD || undefined,
                    }
                });
                qe.setMaxListeners(2000);
                return qe;
            }
        },
        {
            provide: 'QueueEvents2',
            useFactory: () => {
                const { QueueEvents } = require('bullmq');
                const qe = new QueueEvents('bets-2', {
                    connection: {
                        host: process.env.REDIS_HOST || 'localhost',
                        port: parseInt(process.env.REDIS_PORT || '6379'),
                        password: process.env.REDIS_PASSWORD || undefined,
                    }
                });
                qe.setMaxListeners(2000);
                return qe;
            }
        },
        {
            provide: 'QueueEvents3',
            useFactory: () => {
                const { QueueEvents } = require('bullmq');
                const qe = new QueueEvents('bets-3', {
                    connection: {
                        host: process.env.REDIS_HOST || 'localhost',
                        port: parseInt(process.env.REDIS_PORT || '6379'),
                        password: process.env.REDIS_PASSWORD || undefined,
                    }
                });
                qe.setMaxListeners(2000);
                return qe;
            }
        }
    ],
    exports: [SeamlessProducer, BullModule, 'QueueEvents0', 'QueueEvents1', 'QueueEvents2', 'QueueEvents3'],
})
export class SeamlessQueueModule { }
