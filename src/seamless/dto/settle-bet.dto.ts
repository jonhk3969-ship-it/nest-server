
import { IsString, IsNumber, IsArray, ValidateNested, IsOptional, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

class TxnSettleDto {
    @IsString()
    id: string;

    @IsString()
    status: string;

    @IsString()
    roundId: string;

    @IsNumber()
    betAmount: number;

    @IsNumber()
    payoutAmount: number;

    @IsString()
    gameCode: string;

    @IsString()
    playInfo: string;

    @IsNumber()
    @IsOptional()
    turnOver?: number;

    @IsBoolean()
    @IsOptional()
    isSingleState?: boolean;

    @IsString()
    @IsOptional()
    transactionType?: string;

    @IsBoolean()
    @IsOptional()
    isEndRound?: boolean;
}

export class SettleBetDto {
    @IsString()
    id: string;

    @IsString()
    productId: string;

    @IsString()
    username: string;

    @IsString()
    currency: string;

    @IsNumber()
    timestampMillis: number;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TxnSettleDto)
    txns: TxnSettleDto[];
}
