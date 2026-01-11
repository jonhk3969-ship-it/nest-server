
import { IsString, IsNumber, IsArray, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

class TxnCancelDto {
    @IsString()
    id: string;

    @IsString()
    status: string;

    @IsString()
    roundId: string;

    @IsNumber()
    betAmount: number;

    @IsString()
    gameCode: string;

    @IsString()
    playInfo: string;

    @IsString()
    @IsOptional()
    transactionType?: string;
}

export class CancelBetDto {
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
    @Type(() => TxnCancelDto)
    txns: TxnCancelDto[];
}
