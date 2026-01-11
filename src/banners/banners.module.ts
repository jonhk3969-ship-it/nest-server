
import { Module } from '@nestjs/common';
import { BannersService } from './banners.service';
import { BannersController } from './banners.controller';
import { CommonModule } from '../common/common.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [CommonModule, PrismaModule],
    controllers: [BannersController],
    providers: [BannersService],
})
export class BannersModule { }
