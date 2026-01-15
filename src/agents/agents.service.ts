import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AgentsService {
    constructor(private prisma: PrismaService) { }

    async create(createAgentDto: CreateAgentDto) {
        // Check if agent exists
        const existing = await this.prisma.agent.findFirst({
            where: {
                OR: [
                    { username: createAgentDto.username },
                    { agentname: createAgentDto.agentname },
                    { nickName: createAgentDto.nickName }
                ]
            }
        });
        if (existing) throw new BadRequestException('Agent ມີແລ້ວ');

        let password = createAgentDto.password;
        if (!password) {
            // Generate random password: 4 letters + 4 numbers
            const chars = 'abcdefghijklmnopqrstuvwxyz@#$%*';
            const nums = '0123456789';
            let randomChars = '';
            let randomNums = '';
            for (let i = 0; i < 4; i++) randomChars += chars.charAt(Math.floor(Math.random() * chars.length));
            for (let i = 0; i < 4; i++) randomNums += nums.charAt(Math.floor(Math.random() * nums.length));
            password = randomChars + randomNums;
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Use runCommandRaw to bypass P2031 (Transaction requirement) on standalone MongoDB
        // We must manually handle Date fields and clean undefined values
        const doc: any = {
            username: createAgentDto.username,
            password: hashedPassword,
            percent: createAgentDto.percent ?? 0,
            showpassword: password,
            role: 'AGENT',
            status: true,
            amount: 0,
            maxNumUser: createAgentDto.maxNumUser ?? 50,
            createdAt: { $date: new Date().toISOString() },
            updatedAt: { $date: new Date().toISOString() },
        };

        if (createAgentDto.nickName) {
            doc.nickName = createAgentDto.nickName;
        }

        if (createAgentDto.agentname) {
            doc.agentname = createAgentDto.agentname;
        }

        try {
            await this.prisma.$runCommandRaw({
                insert: 'Agent',
                documents: [doc]
            });

            // Fetch and return the key fields to match expected Select output
            return this.prisma.agent.findUnique({
                where: { username: createAgentDto.username },
                select: {
                    id: true,
                    username: true,
                    nickName: true,
                    agentname: true,
                    amount: true,
                    role: true,
                    percent: true,
                    maxNumUser: true,
                    status: true,
                    showpassword: true,
                    createdAt: true,
                    updatedAt: true,
                }
            });
        } catch (error) {
            throw new BadRequestException('Failed to create agent: ' + error.message);
        }
    }

    async findAll(page: number = 1, limit: number = 10) {
        const pageNumber = Math.max(1, Number(page));
        const limitNumber = Math.max(1, Number(limit));
        const skip = (pageNumber - 1) * limitNumber;

        const [data, total] = await Promise.all([
            this.prisma.agent.findMany({
                skip,
                take: limitNumber,
                select: {
                    id: true,
                    username: true,
                    nickName: true,
                    agentname: true,
                    amount: true,
                    role: true,
                    percent: true,
                    maxNumUser: true,
                    status: true,
                    showpassword: true,
                    createdAt: true,
                    updatedAt: true,
                },
                orderBy: { createdAt: 'desc' } // Optional: order by newest first
            }),
            this.prisma.agent.count()
        ]);

        return {
            items: data,
            totalItems: total,
            currentPage: pageNumber,
            totalPages: Math.ceil(total / limitNumber)
        };
    }
    async findOne(id: string) {
        if (!id.match(/^[0-9a-fA-F]{24}$/)) {
            throw new BadRequestException('Invalid Agent ID format');
        }
        const agent = await this.prisma.agent.findUnique({
            where: { id },
            select: {
                id: true,
                username: true,
                nickName: true,
                agentname: true,
                amount: true,
                role: true,
                percent: true,
                maxNumUser: true,
                status: true,
                showpassword: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        if (!agent) {
            throw new BadRequestException('Agent not found');
        }

        return agent;
    }

    async update(id: string, updateAgentDto: UpdateAgentDto) {
        if (!id.match(/^[0-9a-fA-F]{24}$/)) {
            throw new BadRequestException('Invalid Agent ID format');
        }

        const updates: any = { ...updateAgentDto };

        // SECURITY: Prevent non-atomic balance updates
        delete updates.amount;

        if (updateAgentDto.password) {
            updates.showpassword = updateAgentDto.password;
            updates.password = await bcrypt.hash(updateAgentDto.password, 10);
        }

        delete updates.updatedAt; // Ensure we handle this manually
        updates.updatedAt = { $date: new Date().toISOString() };

        await this.prisma.$runCommandRaw({
            update: 'Agent',
            updates: [
                {
                    q: { _id: { $oid: id } },
                    u: { $set: updates }
                }
            ]
        });

        return this.findOne(id);
    }

    async remove(id: string) {
        if (!id.match(/^[0-9a-fA-F]{24}$/)) {
            throw new BadRequestException('Invalid Agent ID format');
        }
        const agent = await this.findOne(id);
        if (!agent) throw new BadRequestException('Agent not found');
        // 1. Delete UserHistory (User-Agent transactions)
        await this.prisma.$runCommandRaw({
            delete: 'UserHistory',
            deletes: [{ q: { agentId: { $oid: id } }, limit: 0 }]
        });

        // 2. Delete AgentHistory (Agent-Admin transactions)
        await this.prisma.$runCommandRaw({
            delete: 'AgentHistory',
            deletes: [{ q: { agentId: { $oid: id } }, limit: 0 }]
        });

        // 3. Delete Users
        await this.prisma.$runCommandRaw({
            delete: 'User',
            deletes: [{ q: { agentId: { $oid: id } }, limit: 0 }]
        });

        // 4. Delete Agent
        const result = await this.prisma.$runCommandRaw({
            delete: 'Agent',
            deletes: [
                {
                    q: { _id: { $oid: id } },
                    limit: 1
                }
            ]
        });
        return {
            success: true,
            message: 'Agent deleted successfully',

        };
    }

    async deposit(id: string, amount: number) {
        const agent = await this.findOne(id);
        if (!agent) throw new BadRequestException('Agent not found');

        // Atomic Update
        await this.prisma.$runCommandRaw({
            update: 'Agent',
            updates: [
                {
                    q: { _id: { $oid: id } },
                    u: {
                        $inc: { amount: amount },
                        $set: { updatedAt: { $date: new Date().toISOString() } }
                    }
                }
            ]
        });

        await this.prisma.$runCommandRaw({
            insert: 'AgentHistory',
            documents: [
                {
                    agentId: { $oid: id },
                    amount: amount,
                    before_amount: agent.amount, // Snapshot (Logging only)
                    after_amount: agent.amount + amount, // Snapshot
                    type: 'DEPOSIT',
                    status: true,
                    date: { $date: new Date().toISOString() }
                }
            ]
        });

        return { success: true, message: 'Deposit successful (Atomic)' };
    }

    async withdraw(id: string, amount: number) {
        const agent = await this.findOne(id);
        if (!agent) throw new BadRequestException('Agent not found');

        // Atomic Update with Guard
        const result: any = await this.prisma.$runCommandRaw({
            update: 'Agent',
            updates: [
                {
                    q: { _id: { $oid: id }, amount: { $gte: amount } },
                    u: {
                        $inc: { amount: -amount },
                        $set: { updatedAt: { $date: new Date().toISOString() } }
                    }
                }
            ]
        });

        if (result.nModified === 0) {
            throw new BadRequestException('Insufficient funds (Atomic Check)');
        }

        await this.prisma.$runCommandRaw({
            insert: 'AgentHistory',
            documents: [
                {
                    agentId: { $oid: id },
                    amount: amount,
                    before_amount: agent.amount,
                    after_amount: agent.amount - amount,
                    type: 'WITHDRAW',
                    status: true,
                    date: { $date: new Date().toISOString() }
                }
            ]
        });

        return { success: true, message: 'Withdraw successful (Atomic)' };
    }

    async getHistory(id: string, page: number = 1, limit: number = 10, startDate?: string, endDate?: string) {
        if (!id.match(/^[0-9a-fA-F]{24}$/)) {
            throw new BadRequestException('Invalid Agent ID format');
        }

        const pageNumber = Math.max(1, Number(page));
        const limitNumber = Math.max(1, Number(limit));
        const skip = (pageNumber - 1) * limitNumber;

        const where: any = { agentId: id };

        if (startDate || endDate) {
            where.date = {};
            if (startDate) {
                where.date['gte'] = new Date(startDate);
            }
            if (endDate) {
                const end = new Date(endDate);
                // Set to end of day if it's just a date string, or trust exact ISO
                // Usually for "endDate", users expect inclusive up to end of that day if time provided is 00:00
                // But sticking to strict ISO comparison is safer unless specified otherwise.
                // Assuming ISO strings.
                where.date['lte'] = end;
            }
        }

        const [items, totalItems] = await Promise.all([
            this.prisma.agentHistory.findMany({
                where,
                skip,
                take: limitNumber,
                orderBy: { date: 'desc' }
            }),
            this.prisma.agentHistory.count({ where })
        ]);

        return {
            items,
            totalItems,
            currentPage: pageNumber,
            totalPages: Math.ceil(totalItems / limitNumber)
        };
    }
    async block(id: string, reason?: string) {
        // Use runCommandRaw for safety (P2031 standalone bypass)

        // 1. Block Agent
        await this.prisma.$runCommandRaw({
            update: 'Agent',
            updates: [
                {
                    q: { _id: { $oid: id } },
                    u: {
                        $set: {
                            status: false,
                            updatedAt: { $date: new Date().toISOString() }
                        }
                    }
                }
            ]
        });

        // 2. Cascade Block to Users (Update status only, no refund)
        await this.prisma.$runCommandRaw({
            update: 'User',
            updates: [
                {
                    q: { agentId: { $oid: id } },
                    u: {
                        $set: {
                            status: false,
                            updatedAt: { $date: new Date().toISOString() }
                        }
                    },
                    multi: true
                }
            ]
        });

        return { success: true, message: 'Agent and associated users blocked' };
    }

    async unblock(id: string, reason?: string) {
        await this.prisma.$runCommandRaw({
            update: 'Agent',
            updates: [
                {
                    q: { _id: { $oid: id } },
                    u: {
                        $set: {
                            status: true,
                            updatedAt: { $date: new Date().toISOString() }
                        }
                    }
                }
            ]
        });
        return { success: true, message: 'Agent unblocked' };
    }

    async getHistoryUserByAgentId(agentId: string, page: number = 1, limit: number = 10) {
        if (!agentId.match(/^[0-9a-fA-F]{24}$/)) {
            throw new BadRequestException('Invalid Agent ID format');
        }

        const pageNumber = Math.max(1, Number(page));
        const limitNumber = Math.max(1, Number(limit));
        const skip = (pageNumber - 1) * limitNumber;

        const where: any = { agentId: agentId };

        const [items, totalItems] = await Promise.all([
            this.prisma.userHistory.findMany({
                where,
                skip,
                take: limitNumber,
                orderBy: { date: 'desc' },
                include: {
                    user: {
                        select: {
                            username: true
                        }
                    }
                }
            }),
            this.prisma.userHistory.count({ where })
        ]);

        return {
            items,
            totalItems,
            currentPage: pageNumber,
            totalPages: Math.ceil(totalItems / limitNumber)
        };
    }
    async getAdminStats(startDate?: string, endDate?: string) {
        let start = startDate ? new Date(startDate) : new Date();
        let end = endDate ? new Date(endDate) : new Date();

        if (!startDate) {
            start.setHours(0, 0, 0, 0);
        }
        if (!endDate) {
            end.setHours(23, 59, 59, 999);
        }

        const history = await this.prisma.userHistory.findMany({
            where: {
                date: {
                    gte: start,
                    lte: end
                }
            },
            select: { amount: true, type: true, agentId: true }
        });

        const agents = await this.prisma.agent.findMany({
            select: { id: true, nickName: true, agentname: true, percent: true }
        });
        const agentMap = new Map(agents.map(a => [a.id, a]));

        const globalStats = {
            transactions: 0,
            deposit: 0,
            withdraw: 0,
            income: 0,
            incomeAfterPercent: 0,
            adminIncome: 0
        };

        const agentStatsMap = new Map<string, {
            agentId: string,
            nickName: string,
            agentname: string,
            percent: number,
            transactions: number,
            deposit: number,
            withdraw: number,
            income: number,
            incomeAfterPercent: number,
            adminIncome: number
        }>();

        for (const agent of agents) {
            agentStatsMap.set(agent.id, {
                agentId: agent.id,
                nickName: agent.nickName || 'Unknown',
                agentname: agent.agentname || '',
                percent: agent.percent || 0,
                transactions: 0,
                deposit: 0,
                withdraw: 0,
                income: 0,
                incomeAfterPercent: 0,
                adminIncome: 0
            });
        }

        for (const record of history) {
            globalStats.transactions += 1;
            const amt = record.amount;
            if (record.type === 'DEPOSIT') {
                globalStats.deposit += amt;
            } else if (record.type === 'WITHDRAW') {
                globalStats.withdraw += amt;
            }

            const agentId = record.agentId;
            if (!agentStatsMap.has(agentId)) continue;

            const stats = agentStatsMap.get(agentId);
            if (stats) {
                const amt = record.amount;
                stats.transactions += 1;
                if (record.type === 'DEPOSIT') {
                    stats.deposit += amt;
                } else if (record.type === 'WITHDRAW') {
                    stats.withdraw += amt;
                }
            }
        }

        globalStats.income = globalStats.deposit - globalStats.withdraw;

        // Global incomeAfterPercent is the Admin's share.
        // Formula: Global Income - Total Agent Share
        // Agent Share = income * (percent / 100)

        let totalAgentShare = 0;

        const agentStats = Array.from(agentStatsMap.values()).map(stats => {
            const income = stats.deposit - stats.withdraw;
            // Formula specified: Agent Share = income * (percent / 100)
            const incomeAfterPercent = income * (stats.percent / 100);

            // Admin Share = Income - Agent Share
            const adminIncome = income - incomeAfterPercent;

            totalAgentShare += incomeAfterPercent;

            return {
                ...stats,
                income: income,
                incomeAfterPercent: incomeAfterPercent,
                adminIncome: adminIncome
            };
        });

        // global.incomeAfterPercent = Total Agent Share
        globalStats.incomeAfterPercent = totalAgentShare;

        // global.adminIncome = Total Admin Share (Total Income - Total Agent Share)
        globalStats.adminIncome = globalStats.income - totalAgentShare;

        agentStats.sort((a, b) => b.income - a.income);

        return {
            global: globalStats,
            agents: agentStats,
            startDate: start,
            endDate: end
        };
    }
}
