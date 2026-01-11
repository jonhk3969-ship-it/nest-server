
import { Controller, Post, Body } from '@nestjs/common';
import { SeamlessService } from './seamless.service';
import { CheckBalanceDto } from './dto/check-balance.dto';
import { BypassTransform } from '../common/decorators/bypass-transform.decorator';
import { PlaceBetDto } from './dto/place-bet.dto';
import { SettleBetDto } from './dto/settle-bet.dto';
import { CancelBetDto } from './dto/cancel-bet.dto';
import { RollbackDto } from './dto/rollback.dto';
import { CancelTipDto } from './dto/cancel-tip.dto';

@Controller('seamless')
export class SeamlessController {
    constructor(private readonly seamlessService: SeamlessService) { }

    @Post('checkBalance')
    @BypassTransform()
    checkBalance(@Body() checkBalanceDto: CheckBalanceDto) {
        return this.seamlessService.checkBalance(checkBalanceDto);
    }

    @Post('placeBets')
    @BypassTransform()
    placeBets(@Body() placeBetDto: PlaceBetDto) {
        return this.seamlessService.placeBets(placeBetDto);
    }

    @Post('settleBets')
    @BypassTransform()
    settleBets(@Body() settleBetDto: SettleBetDto) {
        return this.seamlessService.settleBets(settleBetDto);
    }

    @Post('cancelBets')
    @BypassTransform()
    cancelBets(@Body() dto: CancelBetDto) {
        return this.seamlessService.cancelBets(dto);
    }

    @Post('rollback')
    @BypassTransform()
    rollback(@Body() dto: RollbackDto) {
        return this.seamlessService.rollback(dto);
    }

    @Post('cancelTips')
    @BypassTransform()
    cancelTips(@Body() dto: CancelTipDto) {
        return this.seamlessService.cancelTips(dto);
    }
}
