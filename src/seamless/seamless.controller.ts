
import { Controller, Post, Body, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { SeamlessService } from './seamless.service';
import { SeamlessProducer } from './queue/seamless.producer';
import { CheckBalanceDto } from './dto/check-balance.dto';
import { BypassTransform } from '../common/decorators/bypass-transform.decorator';
import { PlaceBetDto } from './dto/place-bet.dto';
import { SettleBetDto } from './dto/settle-bet.dto';
import { CancelBetDto } from './dto/cancel-bet.dto';
import { RollbackDto } from './dto/rollback.dto';
import { CancelTipDto } from './dto/cancel-tip.dto';
import { AdjustBetDto } from './dto/adjust-bet.dto';
import { WinRewardDto } from './dto/win-reward.dto';
import { PlaceTipDto } from './dto/place-tip.dto';
import { VoidSettleDto } from './dto/void-settle.dto';
import { AdjustBalanceDto } from './dto/adjust-balance.dto';

@Controller('seamless')
export class SeamlessController {
    private queueEvents: any[];

    constructor(
        private readonly seamlessService: SeamlessService,
        private readonly seamlessProducer: SeamlessProducer,
        @Inject('QueueEvents0') private readonly qe0: any,
        @Inject('QueueEvents1') private readonly qe1: any,
        @Inject('QueueEvents2') private readonly qe2: any,
        @Inject('QueueEvents3') private readonly qe3: any,
    ) {
        this.queueEvents = [qe0, qe1, qe2, qe3];
    }



    @Post('checkBalance')
    @BypassTransform()
    async checkBalance(@Body() checkBalanceDto: CheckBalanceDto) {
        // Optimistic Read might be allowed in Standby? 
        // Provider rules say: "Region C Read-only". So checkBalance might be OK?
        // But prompt says: "Standby / DR: Rejects Writes".
        // Let's allow checkBalance for now, but block writes.
        return await this.seamlessService.checkBalance(checkBalanceDto);
    }

    @Post('placeBets')
    @BypassTransform()
    async placeBets(@Body() dto: PlaceBetDto) {
        console.log(`[SEAMLESS] placeBets called - user: ${dto.username}, productId: ${dto.productId}, txns:`, dto.txns?.map(t => ({ id: t.id, betAmount: t.betAmount })));
        // High-Throughput Direct Call (Fast Path)
        return await this.seamlessService.placeBets(dto);
    }

    @Post('settleBets')
    @BypassTransform()
    async settleBets(@Body() dto: SettleBetDto) {
        console.log(`[SEAMLESS] settleBets called - user: ${dto.username}, productId: ${dto.productId}, txns:`, dto.txns?.map(t => ({ id: t.id, betAmount: t.betAmount, payoutAmount: t.payoutAmount })));
        // High-Throughput Direct Call (Fast Path)
        return await this.seamlessService.settleBets(dto);
    }

    @Post('cancelBets')
    @BypassTransform()
    async cancelBets(@Body() dto: CancelBetDto) {

        const { job, idx } = await this.seamlessProducer.addCancelJob(dto);
        try {
            const result = await job.waitUntilFinished(this.queueEvents[idx]);
            return result;
        } catch (error) {
            console.error('Job Wait Failed:', error);
            return { id: dto.id, statusCode: 50001 };
        }
    }

    @Post('rollback')
    @BypassTransform()
    async rollback(@Body() dto: RollbackDto) {

        const { job, idx } = await this.seamlessProducer.addRollbackJob(dto);
        try {
            const result = await job.waitUntilFinished(this.queueEvents[idx]);
            return result;
        } catch (error) {
            console.error('Job Wait Failed:', error);
            return { id: dto.id, statusCode: 50001 };
        }
    }

    @Post('cancelTips')
    @BypassTransform()
    async cancelTips(@Body() dto: CancelTipDto) {

        const { job, idx } = await this.seamlessProducer.addCancelTipJob(dto);
        try {
            const result = await job.waitUntilFinished(this.queueEvents[idx]);
            return result;
        } catch (error) {
            console.error('Job Wait Failed:', error);
            return { id: dto.id, statusCode: 50001 };
        }
    }

    // ================= NEW ENDPOINTS =================

    @Post('adjustBets')
    @BypassTransform()
    async adjustBets(@Body() dto: AdjustBetDto) {
        return await this.seamlessService.adjustBets(dto);
    }

    @Post('winRewards')
    @BypassTransform()
    async winRewards(@Body() dto: WinRewardDto) {
        return await this.seamlessService.winRewards(dto);
    }

    @Post('placeTips')
    @BypassTransform()
    async placeTips(@Body() dto: PlaceTipDto) {
        return await this.seamlessService.placeTips(dto);
    }

    @Post('voidSettled')
    @BypassTransform()
    async voidSettled(@Body() dto: VoidSettleDto) {
        return await this.seamlessService.voidSettled(dto);
    }

    @Post('adjustBalance')
    @BypassTransform()
    async adjustBalance(@Body() dto: AdjustBalanceDto) {
        return await this.seamlessService.adjustBalance(dto);
    }
}
