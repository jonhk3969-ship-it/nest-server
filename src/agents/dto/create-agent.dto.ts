import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';

export class CreateAgentDto {
    @IsString()
    @IsNotEmpty()
    username: string;

    @IsString()
    @IsOptional()
    password?: string;

    @IsString()
    @IsOptional()
    nickName?: string;

    @IsString()
    @IsOptional()
    agentname?: string;

    @IsNumber()
    @IsNumber()
    @IsOptional()
    percent?: number;

    @IsNumber()
    @IsOptional()
    maxNumUser?: number;
}
