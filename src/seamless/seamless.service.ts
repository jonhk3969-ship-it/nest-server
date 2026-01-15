
import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionStatus } from '@prisma/client';
import { CheckBalanceDto } from './dto/check-balance.dto';
import { PlaceBetDto } from './dto/place-bet.dto';
import { SettleBetDto } from './dto/settle-bet.dto';
import { CancelBetDto } from './dto/cancel-bet.dto';
import { CancelTipDto } from './dto/cancel-tip.dto';
import { RollbackDto } from './dto/rollback.dto';

import { SeamlessProducer } from './queue/seamless.producer';
import { REDIS_CLIENT } from '../common/redis/redis.provider';
import type Redis from 'ioredis';

@Injectable()
export class SeamlessService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly seamlessProducer: SeamlessProducer,
        @Inject(REDIS_CLIENT) private readonly redisClient: Redis
    ) { }

    async checkBalance(dto: CheckBalanceDto) {
        try {
            const username = dto.username.toLowerCase();
            // OPTIMIZATION: Try Redis cache first (sub-millisecond)
            const cachedBalance = await this.redisClient.get(`balance:${username}`);

            if (cachedBalance !== null) {
                // Cache HIT - Return immediately without DB query
                return {
                    id: dto.id,
                    statusCode: 0,
                    groupId: '',
                    timestampMillis: Date.now(),
                    productId: dto.productId,
                    currency: dto.currency,
                    balance: Number(cachedBalance),
                    username: dto.username, // Returning original username as per some providers' requirements? Or strict? 
                    // Ideally return what they sent or what we found? 
                    // Let's keep returning dto.username to be safe, but use normalized for lookup.
                };
            }

            // Cache MISS - Fallback to DB (user might not have played yet)
            const user = await this.prisma.user.findUnique({
                where: { username: username },
            });

            if (!user) {
                return {
                    id: dto.id,
                    statusCode: 10001, // User not found
                    productId: dto.productId,
                    timestampMillis: Date.now(),
                };
            }

            // Populate cache for next time
            await this.redisClient.set(`balance:${username}`, user.amount);

            return {
                id: dto.id,
                statusCode: 0, // Success
                groupId: '', // Optional
                timestampMillis: Date.now(),
                productId: dto.productId,
                currency: dto.currency,
                balance: Number(user.amount),
                username: dto.username,
            };
        } catch (error) {
            console.error('Error in checkBalance:', error);
            return {
                id: dto.id,
                statusCode: 50001, // Internal server error
                productId: dto.productId,
                timestampMillis: Date.now(),
            };
        }
    }

    async placeBets(dto: PlaceBetDto) {
        try {
            // Normalize username
            dto.username = dto.username.toLowerCase();

            const user = await this.prisma.user.findUnique({
                where: { username: dto.username },
            });

            if (!user) {
                return {
                    id: dto.id,
                    statusCode: 10001, // User not found
                    productId: dto.productId,
                    timestampMillis: Date.now(),
                };
            }

            let totalBet = 0;
            for (const t of dto.txns) {
                totalBet += t.betAmount;
            }

            // Enrich DTO for Worker (Important!)
            (dto as any).userId = user.id;
            (dto as any).agentId = user.agentId;

            // Fast Path Execution
            let res = await this.seamlessProducer.executeFastBet(dto, totalBet, dto.id);

            // Lazy Load Balance to Redis if missing
            if (res.status === 'MISSING_BAL') {
                await this.seamlessProducer.setRedisBalance(user.username, user.amount);
                // Retry once
                res = await this.seamlessProducer.executeFastBet(dto, totalBet, dto.id);
            }

            if (res.status === 'INSUFFICIENT' || (res.status === 'MISSING_BAL' && user.amount < totalBet)) {
                // If specific transaction failure marking is needed, we can't easily do it here without DB write.
                // But for high-throughput, we prioritize response speed.
                // We return Insufficient Funds error.
                return {
                    id: dto.id,
                    statusCode: 10002, // Insufficient balance
                    productId: dto.productId,
                    timestampMillis: Date.now(),
                    balanceBefore: res.balance || user.amount,
                    balanceAfter: res.balance || user.amount,
                    username: dto.username,
                };
            }

            // Store balance info in DTO for Worker to use (accurate values at time of API call)
            const balanceBefore = res.balance + totalBet;
            const balanceAfter = res.balance;
            (dto as any).balanceBefore = balanceBefore;
            (dto as any).balanceAfter = balanceAfter;

            return {
                id: dto.id,
                statusCode: 0,
                timestampMillis: Date.now(),
                productId: dto.productId,
                currency: dto.currency,
                balanceBefore: balanceBefore,
                balanceAfter: balanceAfter,
                username: dto.username,
            };

        } catch (error) {
            console.error('Error in placeBets:', error);
            // Fallback?
            return {
                id: dto.id,
                statusCode: 50001,
                productId: dto.productId,
                timestampMillis: Date.now(),
            };
        }
    }

    async settleBets(dto: SettleBetDto) {
        try {
            // Normalize username
            dto.username = dto.username.toLowerCase();

            const user = await this.prisma.user.findUnique({
                where: { username: dto.username },
            });

            if (!user) {
                return {
                    id: dto.id,
                    statusCode: 10001,
                    productId: dto.productId,
                    timestampMillis: Date.now(),
                };
            }

            // Calculate totals from transactions
            let totalPayout = 0;
            let totalBet = 0;
            dto.txns.forEach(txn => {
                totalPayout += txn.payoutAmount || 0;
                totalBet += txn.betAmount || 0;
            });

            // Enrich DTO
            (dto as any).userId = user.id;
            (dto as any).agentId = user.agentId;

            // Fast Path Settle
            // Pass both totalBet and totalPayout to handle combined mode (PGSOFT)
            // Net change = payoutAmount - betAmount (works for both ROYAL and PGSOFT)
            let res = await this.seamlessProducer.executeFastSettle(dto, totalBet, totalPayout, dto.id);

            // Lazy Load Balance
            if (res.status === 'MISSING_BAL') {
                await this.seamlessProducer.setRedisBalance(user.username, user.amount);
                res = await this.seamlessProducer.executeFastSettle(dto, totalBet, totalPayout, dto.id);
            }

            // Calculate balance before/after for accurate record keeping
            // net = payoutAmount - betAmount was applied to get res.balance
            const netChange = totalPayout - totalBet;
            const balanceBefore = res.balance - netChange; // Balance before this settle
            const balanceAfter = res.balance; // Current balance after settle

            // Store in DTO for Worker to use
            (dto as any).balanceBefore = balanceBefore;
            (dto as any).balanceAfter = balanceAfter;

            return {
                id: dto.id,
                statusCode: 0,
                productId: dto.productId,
                timestampMillis: Date.now(),
                username: dto.username,
                currency: dto.currency,
                balanceBefore: balanceBefore,
                balanceAfter: balanceAfter
            };

        } catch (error) {
            console.error('Error in settleBets:', error);
            return {
                id: dto.id,
                statusCode: 50001,
                productId: dto.productId,
                timestampMillis: Date.now(),
            };
        }
    }

    async cancelBets(dto: CancelBetDto) {
        try {
            dto.username = dto.username.toLowerCase();
            const user = await this.prisma.user.findUnique({ where: { username: dto.username } });
            if (!user) return { id: dto.id, statusCode: 10001, productId: dto.productId, timestampMillis: Date.now() };

            let totalRefund = 0;
            const validTxns: any[] = [];

            for (const txn of dto.txns) {
                // Idempotency Check
                // Idempotency Check
                const exists = await this.prisma.betTransaction.findUnique({
                    where: { transactionId: txn.id }
                });

                if (!exists) {
                    if (txn.betAmount > 0) {
                        totalRefund += txn.betAmount;
                        validTxns.push(txn);
                    }
                }
            }

            let updatedUser = user;
            if (totalRefund > 0) {
                updatedUser = await this.prisma.$transaction(async (tx) => {
                    const u = await tx.user.update({
                        where: { username: dto.username },
                        data: { amount: { increment: totalRefund } }
                    });

                    return u;
                });

                // Sync Redis cache with new balance
                try {
                    await this.redisClient.set(`balance:${dto.username}`, updatedUser.amount);
                } catch (e) { /* Redis down, ignore */ }
            }

            return {
                id: dto.id,
                statusCode: 0, // Success
                groupId: '', // Optional
                timestampMillis: Date.now(),
                productId: dto.productId,
                currency: dto.currency,
                balanceBefore: user.amount,
                balanceAfter: updatedUser.amount,
                username: dto.username,
            };
        } catch (error) {
            console.error('Error in cancelBets:', error);
            return { id: dto.id, statusCode: 50001, productId: dto.productId, timestampMillis: Date.now() };
        }
    }

    async rollback(dto: RollbackDto) {
        try {
            dto.username = dto.username.toLowerCase();
            const user = await this.prisma.user.findUnique({ where: { username: dto.username } });
            if (!user) return { id: dto.id, statusCode: 10001, productId: dto.productId, timestampMillis: Date.now() };

            let totalDeduct = 0;
            const validTxns: any[] = [];

            for (const txn of dto.txns) {
                // Idempotency Check
                // Idempotency Check
                const exists = await this.prisma.betTransaction.findUnique({
                    where: { transactionId: txn.id }
                });

                if (!exists) {
                    let deduct = 0;
                    if (txn.status === 'SETTLED' && txn.payoutAmount > 0) {
                        deduct = txn.payoutAmount;
                    } else if (txn.status === 'REFUND' && txn.betAmount > 0) {
                        deduct = txn.betAmount;
                    }

                    if (deduct > 0) {
                        totalDeduct += deduct;
                        validTxns.push({ ...txn, deductAmount: deduct });
                    }
                }
            }

            let updatedUser = user;
            if (totalDeduct > 0) {
                updatedUser = await this.prisma.$transaction(async (tx) => {
                    const u = await tx.user.update({
                        where: { username: dto.username },
                        data: { amount: { decrement: totalDeduct } }
                    });

                    return u;
                });

                // Sync Redis cache with new balance
                try {
                    await this.redisClient.set(`balance:${dto.username}`, updatedUser.amount);
                } catch (e) { /* Redis down, ignore */ }
            }

            return {
                id: dto.id,
                statusCode: 0,
                timestampMillis: Date.now(),
                productId: dto.productId,
                currency: dto.currency,
                balanceBefore: user.amount,
                balanceAfter: updatedUser.amount,
                username: dto.username,
            };
        } catch (error) {
            console.error('Error in rollback:', error);
            return { id: dto.id, statusCode: 50001, productId: dto.productId, timestampMillis: Date.now() };
        }
    }

    async cancelTips(dto: CancelTipDto) {
        try {
            dto.username = dto.username.toLowerCase();
            const user = await this.prisma.user.findUnique({ where: { username: dto.username } });
            if (!user) return { id: dto.id, statusCode: 10001, productId: dto.productId, timestampMillis: Date.now() };

            let totalRefund = 0;
            const validTxns: any[] = [];

            for (const txn of dto.txns) {
                // Idempotency check 
                // Idempotency check 
                const exists = await this.prisma.betTransaction.findUnique({
                    where: { transactionId: txn.id }
                });

                if (!exists && txn.betAmount > 0) {
                    totalRefund += txn.betAmount;
                    validTxns.push(txn);
                }
            }

            let updatedUser = user;
            if (totalRefund > 0) {
                updatedUser = await this.prisma.$transaction(async (tx) => {
                    const u = await tx.user.update({
                        where: { username: dto.username },
                        data: { amount: { increment: totalRefund } }
                    });

                    return u;
                });

                // Sync Redis cache with new balance
                try {
                    await this.redisClient.set(`balance:${dto.username}`, updatedUser.amount);
                } catch (e) { /* Redis down, ignore */ }
            }

            return {
                id: dto.id,
                statusCode: 0,
                timestampMillis: Date.now(),
                productId: dto.productId,
                currency: dto.currency,
                balanceBefore: user.amount,
                balanceAfter: updatedUser.amount,
                username: dto.username,
            };

        } catch (error) {
            console.error('Error in cancelTips:', error);
            return { id: dto.id, statusCode: 50001, productId: dto.productId, timestampMillis: Date.now() };
        }
    }

    // ================= NEW APIS =================

    async adjustBets(dto: any) {
        try {
            dto.username = dto.username.toLowerCase();

            const user = await this.prisma.user.findUnique({
                where: { username: dto.username },
            });

            if (!user) {
                return { id: dto.id, statusCode: 10001, productId: dto.productId, timestampMillis: Date.now() };
            }

            // Calculate total adjustment amount
            let totalAdjust = 0;
            for (const txn of dto.txns) {
                totalAdjust += txn.betAmount || 0;
            }

            // Adjust = deduct the new bet amount (the difference is handled by provider)
            const balanceBefore = user.amount;
            const updatedUser = await this.prisma.user.update({
                where: { id: user.id },
                data: { amount: { decrement: totalAdjust } }
            });

            // Sync Redis
            try {
                await this.redisClient.set(`balance:${dto.username}`, updatedUser.amount);
            } catch (e) { /* ignore */ }

            return {
                id: dto.id,
                statusCode: 0,
                timestampMillis: Date.now(),
                productId: dto.productId,
                currency: dto.currency,
                balanceBefore: balanceBefore,
                balanceAfter: updatedUser.amount,
                username: dto.username,
            };

        } catch (error) {
            console.error('Error in adjustBets:', error);
            return { id: dto.id, statusCode: 50001, productId: dto.productId, timestampMillis: Date.now() };
        }
    }

    async winRewards(dto: any) {
        try {
            dto.username = dto.username.toLowerCase();

            const user = await this.prisma.user.findUnique({
                where: { username: dto.username },
            });

            if (!user) {
                return { id: dto.id, statusCode: 10001, productId: dto.productId, timestampMillis: Date.now() };
            }

            // Calculate total payout
            let totalPayout = 0;
            for (const txn of dto.txns) {
                totalPayout += txn.payoutAmount || 0;
            }

            const balanceBefore = user.amount;
            const updatedUser = await this.prisma.user.update({
                where: { id: user.id },
                data: { amount: { increment: totalPayout } }
            });

            // Sync Redis
            try {
                await this.redisClient.set(`balance:${dto.username}`, updatedUser.amount);
            } catch (e) { /* ignore */ }

            return {
                id: dto.id,
                statusCode: 0,
                timestampMillis: Date.now(),
                productId: dto.productId,
                currency: dto.currency,
                balanceBefore: balanceBefore,
                balanceAfter: updatedUser.amount,
                username: dto.username,
            };

        } catch (error) {
            console.error('Error in winRewards:', error);
            return { id: dto.id, statusCode: 50001, productId: dto.productId, timestampMillis: Date.now() };
        }
    }

    async placeTips(dto: any) {
        try {
            dto.username = dto.username.toLowerCase();

            const user = await this.prisma.user.findUnique({
                where: { username: dto.username },
            });

            if (!user) {
                return { id: dto.id, statusCode: 10001, productId: dto.productId, timestampMillis: Date.now() };
            }

            // Calculate total tip amount
            let totalTip = 0;
            for (const txn of dto.txns) {
                totalTip += txn.betAmount || 0;
            }

            // Check balance
            if (user.amount < totalTip) {
                return {
                    id: dto.id,
                    statusCode: 10002,
                    productId: dto.productId,
                    timestampMillis: Date.now(),
                };
            }

            const balanceBefore = user.amount;
            const updatedUser = await this.prisma.user.update({
                where: { id: user.id },
                data: { amount: { decrement: totalTip } }
            });

            // Sync Redis
            try {
                await this.redisClient.set(`balance:${dto.username}`, updatedUser.amount);
            } catch (e) { /* ignore */ }

            return {
                id: dto.id,
                statusCode: 0,
                timestampMillis: Date.now(),
                productId: dto.productId,
                currency: dto.currency,
                balanceBefore: balanceBefore,
                balanceAfter: updatedUser.amount,
                username: dto.username,
            };

        } catch (error) {
            console.error('Error in placeTips:', error);
            return { id: dto.id, statusCode: 50001, productId: dto.productId, timestampMillis: Date.now() };
        }
    }

    async voidSettled(dto: any) {
        try {
            dto.username = dto.username.toLowerCase();

            const user = await this.prisma.user.findUnique({
                where: { username: dto.username },
            });

            if (!user) {
                return { id: dto.id, statusCode: 10001, productId: dto.productId, timestampMillis: Date.now() };
            }

            // Void: balance + (betAmount - payoutAmount)
            // This reverses the original settle
            let totalChange = 0;
            for (const txn of dto.txns) {
                totalChange += (txn.betAmount || 0) - (txn.payoutAmount || 0);
            }

            const balanceBefore = user.amount;
            const updatedUser = await this.prisma.user.update({
                where: { id: user.id },
                data: { amount: { increment: totalChange } }
            });

            // Sync Redis
            try {
                await this.redisClient.set(`balance:${dto.username}`, updatedUser.amount);
            } catch (e) { /* ignore */ }

            return {
                id: dto.id,
                statusCode: 0,
                timestampMillis: Date.now(),
                productId: dto.productId,
                currency: dto.currency,
                balanceBefore: balanceBefore,
                balanceAfter: updatedUser.amount,
                username: dto.username,
            };

        } catch (error) {
            console.error('Error in voidSettled:', error);
            return { id: dto.id, statusCode: 50001, productId: dto.productId, timestampMillis: Date.now() };
        }
    }

    async adjustBalance(dto: any) {
        try {
            dto.username = dto.username.toLowerCase();

            const user = await this.prisma.user.findUnique({
                where: { username: dto.username },
            });

            if (!user) {
                return { id: dto.id, statusCode: 10001, productId: dto.productId, timestampMillis: Date.now() };
            }

            // Calculate total change based on DEBIT/CREDIT
            let totalChange = 0;
            for (const txn of dto.txns) {
                if (txn.status === 'DEBIT') {
                    totalChange -= txn.amount || 0;
                } else if (txn.status === 'CREDIT') {
                    totalChange += txn.amount || 0;
                }
            }

            // Check balance for DEBIT
            if (totalChange < 0 && user.amount < Math.abs(totalChange)) {
                return {
                    id: dto.id,
                    statusCode: 10002,
                    productId: dto.productId,
                    timestampMillis: Date.now(),
                };
            }

            const balanceBefore = user.amount;
            const updatedUser = await this.prisma.user.update({
                where: { id: user.id },
                data: { amount: { increment: totalChange } }
            });

            // Sync Redis
            try {
                await this.redisClient.set(`balance:${dto.username}`, updatedUser.amount);
            } catch (e) { /* ignore */ }

            return {
                id: dto.id,
                statusCode: 0,
                timestampMillis: Date.now(),
                productId: dto.productId,
                currency: dto.currency,
                balanceBefore: balanceBefore,
                balanceAfter: updatedUser.amount,
                username: dto.username,
            };

        } catch (error) {
            console.error('Error in adjustBalance:', error);
            return { id: dto.id, statusCode: 50001, productId: dto.productId, timestampMillis: Date.now() };
        }
    }
}
