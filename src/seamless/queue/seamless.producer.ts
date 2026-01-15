
import { Injectable, Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PlaceBetDto } from '../dto/place-bet.dto';
import { REDIS_CLIENT } from '../../common/redis/redis.provider';
import type Redis from 'ioredis';

@Injectable()
export class SeamlessProducer {
    private queues: Queue[];

    constructor(
        @InjectQueue('bets-0') private q0: Queue,
        @InjectQueue('bets-1') private q1: Queue,
        @InjectQueue('bets-2') private q2: Queue,
        @InjectQueue('bets-3') private q3: Queue,
        @InjectQueue('history') private historyQueue: Queue,
        @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
    ) {
        this.queues = [q0, q1, q2, q3];
    }

    async executeFastBet(dto: any, amount: number, transactionId: string): Promise<{ success: boolean; balance: number; status: string }> {
        // Lua Script:
        // KEYS[1] = balance:{username}
        // KEYS[2] = processed_txns
        // KEYS[3] = queue_key
        // ARGV[1] = amount (positive float)
        // ARGV[2] = transactionId
        // ARGV[3] = dto JSON (we'll add balance info in script)

        const script = `
            local balKey = KEYS[1]
            local dedupKey = KEYS[2]
            local queueKey = KEYS[3]
            local amount = tonumber(ARGV[1])
            local txnId = ARGV[2]
            local dtoJson = ARGV[3]

            -- 1. Dedup
            if redis.call('SISMEMBER', dedupKey, txnId) == 1 then
                local bal = redis.call('GET', balKey)
                if not bal then bal = 0 end
                return {0, bal, "DUP"} 
            end

            -- 2. Check Balance
            local currentBal = redis.call('GET', balKey)
            if not currentBal then 
                return {-1, 0, "MISSING_BAL"} 
            end
            local balBefore = tonumber(currentBal)
            if balBefore < amount then
                return {-2, balBefore, "INSUFFICIENT"}
            end

            -- 3. Deduct & Calculate balanceAfter
            local newBal = redis.call('INCRBYFLOAT', balKey, -amount)
            local balAfter = tonumber(newBal)
            
            -- 4. Lookup gameName
            local productId = ARGV[4]
            local gameCode = ARGV[5]
            
            local gameName = redis.call('GET', 'game_name:' .. productId .. ':' .. gameCode)
            if not gameName then gameName = "" end
            
            -- 5. Build payload securely using cjson
            local payloadTable = {
                type = "BET",
                data = cjson.decode(dtoJson),
                balanceBefore = balBefore,
                balanceAfter = balAfter,
                gameName = gameName
            }
            local payload = cjson.encode(payloadTable)
            
            redis.call('LPUSH', queueKey, payload)
            redis.call('SETEX', 'api_dedup:' .. txnId, 600, '1')
            
            return {1, newBal, "OK"}
        `;

        try {
            const res = await this.redisClient.eval(script, 3,
                `balance:${dto.username}`,
                'processed_txns',
                'seamless_batch_queue',
                amount,
                transactionId,
                JSON.stringify(dto),
                dto.productId,
                (dto.txns && dto.txns.length > 0) ? dto.txns[0].gameCode : ""
            );

            const [code, bal, status] = res as [number, any, string]; // ioredis returns array

            if (code === 1) return { success: true, balance: Number(bal), status: 'OK' };
            if (code === 0) return { success: true, balance: Number(bal), status: 'DUP' }; // Treated as success
            if (status === 'MISSING_BAL') return { success: false, balance: 0, status: 'MISSING_BAL' };
            return { success: false, balance: Number(bal), status };

        } catch (e: any) {
            console.error("FastBet Error Type:", typeof e);
            console.error("FastBet Error toString:", e.toString());
            console.error("FastBet Error Message:", e.message);
            throw e;
        }
    }

    async setRedisBalance(username: string, amount: number) {
        // Use lowercase for key consistency across the system
        await this.redisClient.set(`balance:${username.toLowerCase()}`, amount);
    }

    /**
     * Execute fast settle operation in Redis
     * @param dto The settle DTO
     * @param betAmount Total bet amount from txns (0 for ROYAL-style, >0 for PGSOFT-style combined)
     * @param payoutAmount Total payout amount from txns
     * @param transactionId Unique transaction ID for dedup
     */
    async executeFastSettle(dto: any, betAmount: number, payoutAmount: number, transactionId: string): Promise<{ success: boolean; balance: number; status: string }> {
        // Net change = payoutAmount - betAmount
        // ROYAL: bet=0, payout=X → net = X (just add winnings)
        // PGSOFT: bet=0.9, payout=0 → net = -0.9 (lost bet)
        // PGSOFT: bet=0.9, payout=4.5 → net = 3.6 (won bet)
        const netAmount = payoutAmount - betAmount;

        const script = `
            local balKey = KEYS[1]
            local dedupKey = KEYS[2]
            local queueKey = KEYS[3]
            local netAmount = tonumber(ARGV[1])
            local txnId = ARGV[2]
            local dtoJson = ARGV[3]

            -- 1. Dedup
            if redis.call('GET', 'api_dedup:' .. txnId) then
                local bal = redis.call('GET', balKey)
                if not bal then bal = 0 end
                return {0, bal, "DUP"}
            end

            -- 2. Check Balance exists
            local currentBal = redis.call('GET', balKey)
            if not currentBal then 
                return {-1, 0, "MISSING_BAL"} 
            end
            local balBefore = tonumber(currentBal)

            -- 3. Apply net change (payout - bet) & Calculate balanceAfter
            local newBal = redis.call('INCRBYFLOAT', balKey, netAmount)
            local balAfter = tonumber(newBal)
            
            -- 4. Lookup gameName
            local productId = ARGV[4]
            local gameCode = ARGV[5]
            
            local gameName = redis.call('GET', 'game_name:' .. productId .. ':' .. gameCode)
            if not gameName then gameName = "" end
            
            -- 5. Build payload securely using cjson
            local payloadTable = {
                type = "SETTLE",
                data = cjson.decode(dtoJson),
                balanceBefore = balBefore,
                balanceAfter = balAfter,
                gameName = gameName
            }
            local payload = cjson.encode(payloadTable)
            
            redis.call('LPUSH', queueKey, payload)
            redis.call('SETEX', 'api_dedup:' .. txnId, 600, '1')
            
            return {1, newBal, "OK"}
        `;

        try {
            const res = await this.redisClient.eval(script, 3,
                `balance:${dto.username}`,
                'processed_txns',
                'seamless_batch_queue',
                netAmount,
                transactionId,
                JSON.stringify(dto),
                dto.productId,
                (dto.txns && dto.txns.length > 0) ? dto.txns[0].gameCode : ""
            );

            const [code, bal, status] = res as [number, any, string];

            if (code === 1) return { success: true, balance: Number(bal), status: 'OK' };
            if (code === 0) return { success: true, balance: Number(bal), status: 'DUP' };
            if (status === 'MISSING_BAL') return { success: false, balance: 0, status: 'MISSING_BAL' };
            return { success: false, balance: Number(bal), status };
        } catch (e) {
            console.error("FastSettle Error", e);
            throw e;
        }
    }

    async pushToBatchQueue(data: any) {
        // High-speed ingestion: simple LPUSH to a single list
        // Data should include { type, payload, timestamp }
        await this.redisClient.lpush('seamless_batch_queue', JSON.stringify(data));
    }

    async addHistoryJob(data: any) {
        // Fire and forget, but with reliability settings
        return await this.historyQueue.add('log', data, {
            removeOnComplete: 1000,
            removeOnFail: 5000,
            attempts: 5,
            backoff: { type: 'exponential', delay: 2000 }
        });
    }

    // Simple CRC-like hash for string to 0..3
    getQueueIndex(username: string): number {
        let hash = 0;
        for (let i = 0; i < username.length; i++) {
            hash = (hash + username.charCodeAt(i)) % 4;
        }
        return hash;
    }

    // New helper to return { job, queueIndex } for Controller waiting
    async addBetJob(dto: PlaceBetDto) {
        const idx = this.getQueueIndex(dto.username);
        const job = await this.queues[idx].add('placeBet', dto, {
            jobId: dto.id,
            removeOnComplete: 1000,
            removeOnFail: 5000,
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 }
        });
        return { job, idx };
    }

    async addSettleJob(dto: any) {
        const idx = this.getQueueIndex(dto.username);
        const job = await this.queues[idx].add('settleBet', dto, {
            jobId: dto.id,
            removeOnComplete: 1000,
            removeOnFail: 5000,
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 }
        });
        return { job, idx };
    }

    async addCancelJob(dto: any) {
        const idx = this.getQueueIndex(dto.username);
        const job = await this.queues[idx].add('cancelBet', dto, {
            jobId: dto.id,
            removeOnComplete: 1000,
            removeOnFail: 5000,
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 }
        });
        return { job, idx };
    }

    async addRollbackJob(dto: any) {
        const idx = this.getQueueIndex(dto.username);
        const job = await this.queues[idx].add('rollback', dto, {
            jobId: dto.id,
            removeOnComplete: 1000,
            removeOnFail: 5000,
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 }
        });
        return { job, idx };
    }

    async addCancelTipJob(dto: any) {
        const idx = this.getQueueIndex(dto.username);
        const job = await this.queues[idx].add('cancelTip', dto, {
            jobId: dto.id,
            removeOnComplete: 1000,
            removeOnFail: 5000,
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 }
        });
        return { job, idx };
    }
}
