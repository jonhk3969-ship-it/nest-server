
import { Injectable, OnModuleInit, OnModuleDestroy, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS_CLIENT } from '../../common/redis/redis.provider';
import type Redis from 'ioredis';

@Injectable()
export class SeamlessWorker implements OnModuleInit, OnModuleDestroy {
    private isRunning = false;
    private logger = new Logger('SeamlessWorker');
    private readonly BATCH_SIZE = 2000;
    private readonly QUEUE_KEY = 'seamless_batch_queue';
    private readonly PROCESSED_TTL = 86400; // 24 hours TTL for processed transactions

    constructor(
        private readonly prisma: PrismaService,
        @Inject(REDIS_CLIENT) private readonly redisClient: Redis
    ) { }

    onModuleInit() {
        this.isRunning = true;
        this.runWorkerLoop();
        this.logger.log('SeamlessWorker started (High Throughput Mode).');
    }

    onModuleDestroy() {
        this.isRunning = false;
        // Don't disconnect shared Redis client
    }

    async runWorkerLoop() {
        while (this.isRunning) {
            try {
                // 1. Pull Batch
                // LPOP with count is supported in Redis 6.2+.
                const rawBatch = await this.redisClient.lpop(this.QUEUE_KEY, this.BATCH_SIZE) as string[] | null;

                if (!rawBatch || rawBatch.length === 0) {
                    await new Promise(resolve => setTimeout(resolve, 50)); // Short sleep if empty
                    continue;
                }

                const startTime = Date.now();
                const batch: any[] = [];
                for (const s of rawBatch) {
                    try {
                        batch.push(JSON.parse(s));
                    } catch (e) {
                        this.logger.error('Failed to parse JSON batch item', e);
                    }
                }

                await this.processBatch(batch);

                const duration = Date.now() - startTime;
                if (duration > 1000) {
                    this.logger.warn(`Slow Batch: ${batch.length} items in ${duration}ms`);
                }

                // If we grabbed a full batch, Loop IMMEDIATELY (no sleep) to drain queue
                if (rawBatch.length < this.BATCH_SIZE) {
                    await new Promise(resolve => setTimeout(resolve, 20)); // Breathe slightly
                }

            } catch (error) {
                this.logger.error('Error in worker loop', error);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Sleep on error
            }
        }
    }

    private async processBatch(batch: any[]) {
        if (batch.length === 0) return;

        // 2. Filter Duplicates (Idempotency) - TRUST REDIS
        // We assume items in 'seamless_batch_queue' are mostly valid.
        // But to be safe against crash-replays, we check processed set.

        const operations: any[] = [];
        const dedupIds: string[] = [];

        for (const item of batch) {
            if (!item.data || !item.data.txns) continue;

            const opType = item.type;
            for (const t of item.data.txns) {
                // IMPORTANT: Ensure we have userId/agentId. If Producer missed it, we skip or invalid?
                // We will SKIP to avoid DB crash.
                if (!item.data.userId) {
                    // console.warn('Missing userId in payload', t.id); 
                    continue;
                }

                operations.push({
                    ...t,
                    user: item.data.username,
                    opType,
                    userId: item.data.userId,
                    agentId: item.data.agentId,
                    itemData: item.data,
                    // Balance info from Lua script (at root level of payload)
                    // Balance info from Lua script (at root level of payload)
                    payloadBalanceBefore: item.balanceBefore,
                    payloadBalanceAfter: item.balanceAfter,
                    gameName: item.gameName
                });
                dedupIds.push(t.id);
            }
        }

        if (operations.length === 0) return;

        // Dedup Check - using SETEX keys with TTL instead of SET
        const pipeline = this.redisClient.pipeline();
        dedupIds.forEach(id => pipeline.exists(`processed:${id}`));
        const results = await pipeline.exec();

        const validOps: any[] = [];
        const newTxnIds: string[] = [];

        operations.forEach((op, index) => {
            if (results && results[index] && results[index][1] === 0) { // Key doesn't exist
                validOps.push(op);
                newTxnIds.push(op.id);
            }
        });

        if (validOps.length === 0) return;

        // 3. Aggregate per User
        const userAgg = new Map<string, { net: number, spinCount: number }>();
        const historyRecords: any[] = [];

        for (const op of validOps) {
            let net = 0;
            let spin = 0;
            const username = op.user;

            // Use balance values from payload root (calculated atomically in Lua script)
            // Fallback to 0 if not available (for legacy queue items)
            const dtoBalanceBefore = op.payloadBalanceBefore;
            const dtoBalanceAfter = op.payloadBalanceAfter;

            if (op.opType === 'BET') {
                net = -op.betAmount;
                spin = 1;

                historyRecords.push({
                    userId: op.userId,
                    agentId: op.agentId,
                    username: username,
                    betAmount: op.betAmount,
                    payoutAmount: 0,
                    netAmount: net,
                    balanceBefore: dtoBalanceBefore ?? 0,
                    balanceAfter: dtoBalanceAfter ?? 0,
                    transactionId: op.id,
                    type: 'BET',
                    status: 'SUCCESS',
                    transactionTime: new Date(op.itemData.timestampMillis || Date.now()),
                    productId: op.itemData.productId,
                    gameCode: op.gameCode,
                    gameName: (typeof op.gameName === 'string') ? op.gameName : ""
                });
            } else if (op.opType === 'SETTLE') {
                // SETTLE: net = payoutAmount - betAmount
                // ROYAL: bet=0, payout=X → net = X (add winnings)
                // PGSOFT: bet=0.9, payout=0 → net = -0.9 (lost)
                // PGSOFT: bet=0.9, payout=4.5 → net = 3.6 (won)
                net = op.payoutAmount - op.betAmount;

                historyRecords.push({
                    userId: op.userId,
                    agentId: op.agentId,
                    username: username,
                    betAmount: op.betAmount,
                    payoutAmount: op.payoutAmount,
                    netAmount: net,
                    balanceBefore: dtoBalanceBefore ?? 0,
                    balanceAfter: dtoBalanceAfter ?? 0,
                    transactionId: op.id,
                    type: 'SETTLE',
                    status: 'SUCCESS',
                    transactionTime: new Date(op.itemData.timestampMillis || Date.now()),
                    productId: op.itemData.productId,
                    gameCode: op.gameCode,
                    gameName: (typeof op.gameName === 'string') ? op.gameName : ""
                });
            }

            const current = userAgg.get(op.user) || { net: 0, spinCount: 0 };
            current.net += net;
            current.spinCount += spin;
            userAgg.set(op.user, current);
        }

        // 4. DB Write - User Balance (Bulk)
        const userDbUpdates: any[] = [];
        for (const [username, data] of userAgg) {
            userDbUpdates.push({
                q: { username: username },
                u: { $inc: { amount: data.net } }, // Removed spin increment
                upsert: false
            });
        }

        if (userDbUpdates.length > 0) {
            try {
                // Try "User" first (PascalCase is default model name)
                await this.prisma.$runCommandRaw({
                    update: "User",
                    updates: userDbUpdates,
                    ordered: false
                } as any);
            } catch (e: any) {
                // Fallback to "users" if User collection not found
                // this.logger.warn(`User bulk write failed, retrying with 'users': ${e.message}`);
                try {
                    await this.prisma.$runCommandRaw({
                        update: "users",
                        updates: userDbUpdates,
                        ordered: false
                    } as any);
                } catch (e2) {
                    this.logger.error("Bulk Write Failed (User Amount)", e2);
                }
            }
        }

        // 5. DB Write - History (Bulk)
        if (historyRecords.length > 0) {
            try {
                await this.prisma.betTransaction.createMany({
                    data: historyRecords.map(h => ({
                        ...h,
                        type: h.type as any,
                        status: h.status as any
                    }))
                });
            } catch (e) {
                this.logger.error("Bulk Write Failed (History)", e);
            }
        }

        // 6. Ack in Redis with TTL (24h) to prevent memory bloat
        const ackPipeline = this.redisClient.pipeline();
        newTxnIds.forEach(id => ackPipeline.setex(`processed:${id}`, this.PROCESSED_TTL, '1'));
        await ackPipeline.exec();
    }
}
