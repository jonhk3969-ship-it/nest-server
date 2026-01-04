import { PartialType } from '@nestjs/mapped-types';
import { CreateAgentDto } from './create-agent.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateAgentDto extends PartialType(CreateAgentDto) {
    @IsBoolean()
    @IsOptional()
    status?: boolean;
}
