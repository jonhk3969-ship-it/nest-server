
import { IsString, IsBoolean, IsOptional, IsNumber, IsArray } from 'class-validator';

export class LoginGameDto {
    @IsString()
    productId: string;

    @IsString()
    gameCode: string;

    @IsBoolean()
    @IsOptional()
    isMobileLogin?: boolean;

    @IsArray()
    @IsOptional()
    betLimit?: any[];
}
