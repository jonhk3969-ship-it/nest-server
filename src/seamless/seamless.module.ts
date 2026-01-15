
import { Module } from '@nestjs/common';
import { SeamlessQueueModule } from './queue/seamless-queue.module';
import { SeamlessService } from './seamless.service';
import { SeamlessController } from './seamless.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule, SeamlessQueueModule],
    controllers: [SeamlessController],
    providers: [SeamlessService],
})
export class SeamlessModule { }
