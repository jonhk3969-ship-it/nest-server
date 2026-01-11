
import { IsString, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class TxnCancelTipDto {
    @IsString()
    id: string;

    @IsString()
    status: string;

    @IsString()
    roundId: string;

    @IsNumber()
    betAmount: number;
}

export class CancelTipDto {
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
    @Type(() => TxnCancelTipDto)
    txns: TxnCancelTipDto[];
}
