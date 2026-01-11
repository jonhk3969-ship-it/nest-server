
import { IsString, IsNumber, IsArray, ValidateNested, IsOptional, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

class TxnDto {
    @IsString()
    id: string;

    @IsString()
    gameCode: string;

    @IsString()
    status: string;

    @IsString()
    roundId: string;

    @IsNumber()
    betAmount: number;

    @IsString()
    playInfo: string;

    @IsBoolean()
    @IsOptional()
    isFeature?: boolean;

    @IsBoolean()
    @IsOptional()
    isFeatureBuy?: boolean;
}

export class PlaceBetDto {
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
    @Type(() => TxnDto)
    txns: TxnDto[];
}
