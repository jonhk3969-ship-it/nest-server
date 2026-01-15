
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { SeamlessService } from '../seamless.service';
import { PlaceBetDto } from '../dto/place-bet.dto';

import { OnModuleInit } from '@nestjs/common';

// Base Processor (No Decorator)
export class SeamlessBaseProcessor extends WorkerHost implements OnModuleInit {
    constructor(protected readonly seamlessService: SeamlessService) {
        super();
    }

    async onModuleInit() {
        // Purged Region Logic
    }

    async process(job: Job<any, any, string>): Promise<any> {
        const dto = job.data;
        console.log(`[Worker ${job.queueName}] Processing Job ${job.id}`);
        try {
            switch (job.name) {
                case 'placeBet':
                    return await this.seamlessService.placeBets(dto);
                case 'settleBet':
                    return await this.seamlessService.settleBets(dto);
                case 'cancelBet':
                    return await this.seamlessService.cancelBets(dto);
                case 'rollback':
                    return await this.seamlessService.rollback(dto);
                case 'cancelTip':
                    return await this.seamlessService.cancelTips(dto);
                default:
                    throw new Error(`Unknown Job Name: ${job.name}`);
            }
        } catch (error) {
            console.error(`[Worker ${job.queueName}] Job ${job.id} Failed:`, error.message);
            throw error;
        }
    }
}

// Sharded Processors
@Processor('bets-0')
export class SeamlessProcessor0 extends SeamlessBaseProcessor {
    constructor(seamlessService: SeamlessService) { super(seamlessService); }
}

@Processor('bets-1')
export class SeamlessProcessor1 extends SeamlessBaseProcessor {
    constructor(seamlessService: SeamlessService) { super(seamlessService); }
}

@Processor('bets-2')
export class SeamlessProcessor2 extends SeamlessBaseProcessor {
    constructor(seamlessService: SeamlessService) { super(seamlessService); }
}

@Processor('bets-3')
export class SeamlessProcessor3 extends SeamlessBaseProcessor {
    constructor(seamlessService: SeamlessService) { super(seamlessService); }
}

// Keep old named export for backward compatibility if needed, but better to remove
// export class SeamlessProcessor extends SeamlessBaseProcessor {}
