
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CheckBalanceDto } from './dto/check-balance.dto';
import { PlaceBetDto } from './dto/place-bet.dto';
import { SettleBetDto } from './dto/settle-bet.dto';
import { CancelBetDto } from './dto/cancel-bet.dto';
import { CancelTipDto } from './dto/cancel-tip.dto';
import { RollbackDto } from './dto/rollback.dto';

@Injectable()
export class SeamlessService {
    constructor(private readonly prisma: PrismaService) { }

    async checkBalance(dto: CheckBalanceDto) {
        try {
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

            return {
                id: dto.id,
                statusCode: 0, // Success
                groupId: '', // Optional
                timestampMillis: Date.now(),
                productId: dto.productId,
                currency: dto.currency,
                balance: user.amount,
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
            dto.txns.forEach(txn => totalBet += txn.betAmount);

            if (user.amount < totalBet) {
                return {
                    id: dto.id,
                    statusCode: 10002, // Insufficient balance
                    productId: dto.productId,
                    timestampMillis: Date.now(),
                    balanceBefore: user.amount,
                    balanceAfter: user.amount,
                    username: dto.username,
                };
            }

            const updatedUser = await this.prisma.user.update({
                where: { username: dto.username },
                data: {
                    amount: { decrement: totalBet }
                }
            });

            // Execute writes in parallel to reduce latency
            await Promise.all([
                // 1. Balance Flow (Audit)
                this.prisma.userHistory.createMany({
                    data: dto.txns.map(txn => ({
                        userId: user.id,
                        agentId: user.agentId,
                        amount: txn.betAmount,
                        before_amount: user.amount,
                        after_amount: updatedUser.amount,
                        type: 'BET' as any,
                        transactionId: txn.id,
                        status: true,
                        date: new Date()
                    }))
                }),
                // 2. Game Detail Flow (Report)
                this.prisma.betTransaction.createMany({
                    data: dto.txns.map(txn => ({
                        userId: user.id,
                        username: user.username,
                        agentId: user.agentId,
                        productId: dto.productId,
                        gameCode: txn.gameCode,
                        type: 'BET' as any,
                        betAmount: txn.betAmount,
                        payoutAmount: 0,
                        netAmount: -txn.betAmount,
                        transactionId: txn.id,
                        roundId: txn.roundId,
                        status: 'PENDING',
                        playInfo: txn.playInfo,
                        transactionTime: new Date(dto.timestampMillis)
                    }))
                })
            ]);

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
            console.error('Error in placeBets:', error);
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

            let totalChange = 0;

            // Calculate total change
            dto.txns.forEach(txn => {
                let change = txn.payoutAmount;
                // If single state or specific logic requires deducting betAmount
                // Usually settle adds payout. If bet was not deducted in placeBets (rare for seamless), we might need to deduct here.
                // Assuming standard seamless: placeBets deducted, settleBets adds payout.
                // UNLESS "betAmount" is sent and implies deduction. 
                // Provider docs say: "If isSingleState... we can't identify betAmount from /placeBets... check player's balance by betAmount first"
                // So if single state, we should deduct betAmount too?

                // Logic based on docs:
                // "If betAmount > 0 and payoutAmount > betAmount, the player is win"
                // "Update user's balance with betAmount or payoutAmount"

                // Let's implement robust logic:
                // 1. If txn.betAmount > 0, it MIGHT need deduction if NOT already deducted (e.g. Single State)
                // 2. txn.payoutAmount is ALWAYS added.

                // Simplification for MVP: Always ADD payoutAmount. 
                // IF isSingleState or no corresponding PlaceBet, we might need to deduct betAmount.
                // Docs say: "Product Single State ... the round do not start by /placeBets ... sent both betAmount and payoutAmount"

                // Only deduct betAmount if it's strictly a Single State transaction (Bet + Settle in one)
                if (txn.betAmount > 0 && txn.isSingleState) {
                    change -= txn.betAmount;
                }

                totalChange += change;
            });

            // Check balance for deduction (if net negative or large bet in single state)
            // Ideally we check deduction separately.

            const updatedUser = await this.prisma.user.update({
                where: { username: dto.username },
                data: {
                    amount: { increment: totalChange }
                }
            });

            // Execute writes in parallel
            await Promise.all([
                // 1. Balance Flow
                this.prisma.userHistory.createMany({
                    data: dto.txns.map(txn => ({
                        userId: user.id,
                        agentId: user.agentId,
                        amount: txn.payoutAmount,
                        before_amount: user.amount,
                        after_amount: updatedUser.amount,
                        type: 'SETTLE' as any,
                        transactionId: txn.id,
                        status: true,
                        date: new Date()
                    }))
                }),
                // 2. Game Detail Flow
                this.prisma.betTransaction.createMany({
                    data: dto.txns.map(txn => ({
                        userId: user.id,
                        username: user.username,
                        agentId: user.agentId,
                        productId: dto.productId,
                        gameCode: txn.gameCode,
                        type: 'SETTLE' as any,
                        betAmount: txn.betAmount,
                        payoutAmount: txn.payoutAmount,
                        netAmount: txn.payoutAmount - txn.betAmount,
                        transactionId: txn.id,
                        roundId: txn.roundId,
                        status: 'SETTLED',
                        playInfo: txn.playInfo,
                        transactionTime: new Date(dto.timestampMillis)
                    }))
                })
            ]);

            return {
                id: dto.id,
                statusCode: 0,
                productId: dto.productId,
                timestampMillis: Date.now(),
                username: dto.username,
                currency: dto.currency,
                balanceBefore: user.amount,
                balanceAfter: updatedUser.amount
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
            const user = await this.prisma.user.findUnique({ where: { username: dto.username } });
            if (!user) return { id: dto.id, statusCode: 10001, productId: dto.productId, timestampMillis: Date.now() };

            let totalRefund = 0;
            const validTxns: any[] = [];

            for (const txn of dto.txns) {
                // Idempotency Check
                const exists = await this.prisma.userHistory.findFirst({
                    where: { transactionId: txn.id, type: 'CANCEL' as any }
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
                updatedUser = await this.prisma.user.update({
                    where: { username: dto.username },
                    data: { amount: { increment: totalRefund } }
                });

                await this.prisma.userHistory.createMany({
                    data: validTxns.map(txn => ({
                        userId: user.id,
                        agentId: user.agentId,
                        amount: txn.betAmount,
                        before_amount: user.amount, // Approximate
                        after_amount: updatedUser.amount,
                        type: 'CANCEL' as any,
                        transactionId: txn.id,
                        roundId: txn.roundId,
                        status: true,
                        date: new Date()
                    }))
                });
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
            console.error('Error in cancelBets:', error);
            return { id: dto.id, statusCode: 50001, productId: dto.productId, timestampMillis: Date.now() };
        }
    }

    async rollback(dto: RollbackDto) {
        try {
            const user = await this.prisma.user.findUnique({ where: { username: dto.username } });
            if (!user) return { id: dto.id, statusCode: 10001, productId: dto.productId, timestampMillis: Date.now() };

            let totalDeduct = 0;
            const validTxns: any[] = [];

            for (const txn of dto.txns) {
                // Idempotency Check
                const exists = await this.prisma.userHistory.findFirst({
                    where: { transactionId: txn.id, type: 'ROLLBACK' as any }
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
                updatedUser = await this.prisma.user.update({
                    where: { username: dto.username },
                    data: { amount: { decrement: totalDeduct } }
                });

                await this.prisma.userHistory.createMany({
                    data: validTxns.map(txn => ({
                        userId: user.id,
                        agentId: user.agentId,
                        amount: -txn.deductAmount, // Negative to show deduction
                        before_amount: user.amount,
                        after_amount: updatedUser.amount,
                        type: 'ROLLBACK' as any,
                        transactionId: txn.id,
                        roundId: txn.roundId,
                        status: true,
                        date: new Date()
                    }))
                });
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
            const user = await this.prisma.user.findUnique({ where: { username: dto.username } });
            if (!user) return { id: dto.id, statusCode: 10001, productId: dto.productId, timestampMillis: Date.now() };

            let totalRefund = 0;
            const validTxns: any[] = [];

            for (const txn of dto.txns) {
                // Idempotency check 
                const exists = await this.prisma.userHistory.findFirst({
                    where: { transactionId: txn.id, type: 'CANCEL' as any } // Treating cancelTip as CANCEL type
                });

                if (!exists && txn.betAmount > 0) {
                    totalRefund += txn.betAmount;
                    validTxns.push(txn);
                }
            }

            let updatedUser = user;
            if (totalRefund > 0) {
                updatedUser = await this.prisma.user.update({
                    where: { username: dto.username },
                    data: { amount: { increment: totalRefund } }
                });

                await this.prisma.userHistory.createMany({
                    data: validTxns.map(txn => ({
                        userId: user.id,
                        agentId: user.agentId,
                        amount: txn.betAmount,
                        before_amount: user.amount,
                        after_amount: updatedUser.amount,
                        type: 'CANCEL' as any,
                        transactionId: txn.id,
                        roundId: txn.roundId,
                        status: true,
                        date: new Date()
                    }))
                });
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
}
