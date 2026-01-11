
import { IsString, IsNumber, IsArray, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

class TxnRollbackDto {
    @IsString()
    id: string;

    @IsString()
    status: string;

    @IsString()
    roundId: string;

    @IsString()
    gameCode: string;

    @IsString()
    playInfo: string;

    @IsNumber()
    payoutAmount: number;

    @IsNumber()
    betAmount: number;

    @IsString()
    @IsOptional()
    transactionType?: string;
}

export class RollbackDto {
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
    @Type(() => TxnRollbackDto)
    txns: TxnRollbackDto[];
}
