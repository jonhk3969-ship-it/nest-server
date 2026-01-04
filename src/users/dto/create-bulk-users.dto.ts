import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class CreateBulkUsersDto {
    @IsString()
    @IsNotEmpty()
    agentId: string;

    @IsNumber()
    @Min(1)
    quantity: number;
}
