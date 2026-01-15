
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { Logger } from '@nestjs/common';

@Processor('history')
export class HistoryProcessor extends WorkerHost {
    private readonly logger = new Logger(HistoryProcessor.name);
    private buffer: any[] = [];
    private readonly BATCH_SIZE = 500;
    private readonly FLUSH_INTERVAL = 1000; // 1 second
    private timer: NodeJS.Timeout | null = null;

    constructor(private readonly prisma: PrismaService) {
        super();
        this.startTimer();
    }

    private startTimer() {
        if (this.timer) clearInterval(this.timer);
        this.timer = setInterval(() => {
            this.flush();
        }, this.FLUSH_INTERVAL);
    }

    async process(job: Job<any, any, string>): Promise<any> {
        // We accumulate data and mark job done immediately to keep queue moving fast.
        // Recovery relying on BetTransaction if this node crashes with buffer.
        this.buffer.push(job.data);
        if (this.buffer.length >= this.BATCH_SIZE) {
            await this.flush();
        }
        return true;
    }

    private async flush() {
        if (this.buffer.length === 0) return;

        const chunk = [...this.buffer];
        this.buffer = []; // Clear immediately

        try {
            await this.prisma.userHistory.createMany({
                data: chunk.map(item => ({
                    userId: item.userId,
                    agentId: item.agentId,
                    amount: item.amount,
                    before_amount: item.before_amount,
                    after_amount: item.after_amount,
                    type: item.type,
                    // transactionId removed as per schema update
                    roundId: item.roundId,
                    status: item.status !== undefined ? item.status : true,
                    date: new Date(item.date || Date.now())
                }))
            });
            this.logger.log(`[History] Flushed ${chunk.length} items.`);
        } catch (error) {
            this.logger.error(`[History] Flush Failed for ${chunk.length} items`, error);
            // In a real production system, we might dump this to a file or retry queue.
            // For now, we log error. Data is recoverable from BetTransaction.
        }
    }
}
