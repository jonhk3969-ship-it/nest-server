
import { Module } from '@nestjs/common';
import { ProvidersService } from './providers.service';
import { ProvidersController } from './providers.controller';
import { CommonModule } from '../common/common.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [CommonModule, PrismaModule],
    controllers: [ProvidersController],
    providers: [ProvidersService],
})
export class ProvidersModule { }
