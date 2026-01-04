import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, IsEnum } from 'class-validator';

export class CreateUserDto {
    @IsString()
    @IsNotEmpty()
    username: string;

    @IsString()
    @IsNotEmpty()
    password: string;

    @IsString()
    @IsNotEmpty()
    agentId: string;

    @IsNumber()
    @IsOptional()
    amount?: number;

    @IsNumber()
    @IsOptional()
    spin?: number;
}
