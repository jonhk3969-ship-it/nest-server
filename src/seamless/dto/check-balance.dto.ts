
import { IsString, IsNumber, IsOptional } from 'class-validator';

export class CheckBalanceDto {
    @IsString()
    id: string;

    @IsNumber()
    timestampMillis: number;

    @IsString()
    productId: string;

    @IsString()
    currency: string;

    @IsString()
    username: string;

    @IsString()
    @IsOptional()
    gameCode?: string;

    @IsString()
    @IsOptional()
    sessionToken?: string;
}
