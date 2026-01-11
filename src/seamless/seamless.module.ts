
import { Module } from '@nestjs/common';
import { SeamlessService } from './seamless.service';
import { SeamlessController } from './seamless.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [SeamlessController],
    providers: [SeamlessService],
})
export class SeamlessModule { }
