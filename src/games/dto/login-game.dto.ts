
import { IsString, IsBoolean, IsOptional, IsNumber, IsArray } from 'class-validator';

export class LoginGameDto {
    @IsString()
    productId: string;

    @IsString()
    gameCode: string;

    @IsString()
    @IsOptional()
    gameName?: string;

    @IsBoolean()
    @IsOptional()
    isMobileLogin?: boolean;

    @IsArray()
    @IsOptional()
    betLimit?: any[];
}
