import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateBulkUsersDto } from './dto/create-bulk-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';
import { REDIS_CLIENT } from '../common/redis/redis.provider';
import type Redis from 'ioredis';

@Injectable()
export class UsersService {
    constructor(
        private readonly prisma: PrismaService,
        @Inject(REDIS_CLIENT) private readonly redisClient: Redis
    ) { }

    async create(createUserDto: CreateUserDto) {
        const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
        return this.prisma.user.create({
            data: {
                ...createUserDto,
                password: hashedPassword,
                showpassword: createUserDto.password,
            },
        });
    }

    async createBulk(bulkDto: CreateBulkUsersDto) {
        const agentId = bulkDto.agentId;
        const quantity = bulkDto.quantity;

        // 1. Validate Agent
        const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
        if (!agent) throw new BadRequestException('ບໍ່ພົບຕົວແທນ');
        if (agent.status === false) throw new BadRequestException('ຕົວແທນຖືກບລັອກ');
        if (!agent.nickName) throw new BadRequestException('ຕົວແທນຍັງບໍ່ໄດ້ຕັ້ງຊື່ຫຼິ້ນ');

        // 2. Check Limits
        const currentUsersCount = await this.prisma.user.count({ where: { agentId } });
        if (currentUsersCount + quantity > agent.maxNumUser) {
            throw new BadRequestException('ຈຳນວນຜູ້ໃຊ້ເຕັມແລ້ວ');
        }

        // 3. Determine Starting Sequence
        // Fetch existing usernames starting with nickname
        const existingUsers = await this.prisma.user.findMany({
            where: {
                agentId,
                username: { startsWith: agent.nickName }
            },
            select: { username: true }
        });

        // Extract numbers and find max
        let maxSeq = -1;
        const regex = new RegExp(`^${agent.nickName}(\\d+)$`);

        existingUsers.forEach(u => {
            const match = u.username.match(regex);
            if (match) {
                const num = parseInt(match[1], 10);
                if (num > maxSeq) maxSeq = num;
            }
        });

        let currentSeq = maxSeq + 1;

        // 4. Generate Users
        const usersToInsert: any[] = [];
        const timestamp = new Date().toISOString();

        for (let i = 0; i < quantity; i++) {
            const username = `${agent.nickName}${String(currentSeq).padStart(4, '0')}`;
            currentSeq++;

            // Generate 5-digit random password
            const password = Math.floor(10000 + Math.random() * 90000).toString();
            const hashedPassword = await bcrypt.hash(password, 10);

            usersToInsert.push({
                username: username,
                password: hashedPassword,
                showpassword: password,
                amount: 0.0,
                spin: 0,
                role: 'USER',
                agentId: { $oid: agentId },
                status: true,
                isOnline: false,
                ip: null,
                createdAt: { $date: timestamp },
                updatedAt: { $date: timestamp }
            });
        }

        // 5. Bulk Insert
        await this.prisma.$runCommandRaw({
            insert: 'User',
            documents: usersToInsert
        });

        return { status: 'ok', message: 'ສ້າງຜູ້ໃຊ້ສຳເລັດ' };
    }

    findAll() {
        return this.prisma.user.findMany({
            select: {
                id: true,
                username: true,
                showpassword: true,
                amount: true,
                spin: true,
                agentId: true,
                status: true,
                isOnline: true,
                ip: true,
                createdAt: true,
                updatedAt: true,
            },
            orderBy: { username: 'asc' }
        });
    }

    async findAllByAgent(agentId: string, page: number = 1, limit: number = 10, startDate?: string, endDate?: string) {
        const pageNumber = Math.max(1, Number(page));
        const limitNumber = Math.max(1, Number(limit));
        const skip = (pageNumber - 1) * limitNumber;

        const where: any = { agentId };

        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) {
                where.createdAt['gte'] = new Date(startDate);
            }
            if (endDate) {
                // Ensure end of da y if only date is provided, or rely on exact ISO
                // For simplified ISO handling, we just use the provided string/date
                where.createdAt['lte'] = new Date(endDate);
            }
        }

        const [items, totalItems] = await Promise.all([
            this.prisma.user.findMany({
                where,
                skip,
                take: limitNumber,
                select: {
                    id: true,
                    username: true,
                    showpassword: true,
                    amount: true,
                    spin: true,
                    agentId: true,
                    status: true,
                    isOnline: true,
                    ip: true,
                    createdAt: true,
                    updatedAt: true,
                },
                orderBy: { username: 'asc' }
            }),
            this.prisma.user.count({ where })
        ]);

        return {
            items,
            totalItems,
            currentPage: pageNumber,
            totalPages: Math.ceil(totalItems / limitNumber)
        };
    }

    async searchByAgent(agentId: string, search: string, page: number = 1, limit: number = 10) {
        const pageNumber = Math.max(1, Number(page));
        const limitNumber = Math.max(1, Number(limit));
        const skip = (pageNumber - 1) * limitNumber;

        const where: any = {
            agentId,
            username: { contains: search.trim(), mode: 'insensitive' }
        };

        const [items, totalItems] = await Promise.all([
            this.prisma.user.findMany({
                where,
                skip,
                take: limitNumber,
                select: {
                    id: true,
                    username: true,
                    showpassword: true,
                    amount: true,
                    spin: true,
                    agentId: true,
                    status: true,
                    isOnline: true,
                    ip: true,
                    createdAt: true,
                    updatedAt: true,
                },
                orderBy: { username: 'asc' }
            }),
            this.prisma.user.count({ where })
        ]);

        return {
            items,
            totalItems,
            currentPage: pageNumber,
            totalPages: Math.ceil(totalItems / limitNumber)
        };
    }

    async findOne(id: string) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                username: true,
                showpassword: true,
                amount: true,
                spin: true,
                role: true,
                agentId: true,
                status: true,
                isOnline: true,
                ip: true,
                createdAt: true,
                updatedAt: true,
            }
        });
        return {
            status: 'ok',
            data: user
        };
    }

    async getAmount(userId: string) {
        // First, get username from user to lookup Redis cache
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { username: true, amount: true }
        });

        if (!user) {
            throw new BadRequestException('User not found');
        }

        // IMPORTANT: Use lowercase username for Redis key consistency with SeamlessService
        const usernameKey = user.username.toLowerCase();

        // Try Redis cache first (sub-millisecond) - updated by Seamless worker
        const cachedBalance = await this.redisClient.get(`balance:${usernameKey}`);

        // Debug Log
        console.log(`getAmount: User=${usernameKey}, Redis=${cachedBalance}, DB=${user.amount}`);

        if (cachedBalance !== null) {
            return {
                status: 'ok',
                data: { amount: Number(cachedBalance) }
            };
        }

        // Cache miss - return DB value and populate cache
        await this.redisClient.set(`balance:${usernameKey}`, user.amount);

        return {
            status: 'ok',
            data: { amount: Number(user.amount) }
        };
    }

    async update(id: string, updateUserDto: UpdateUserDto) {
        if (!id.match(/^[0-9a-fA-F]{24}$/)) {
            throw new BadRequestException('ຮູບແບບ ID ຜູ້ໃຊ້ບໍ່ຖືກຕ້ອງ');
        }

        const updates: any = { ...updateUserDto };

        if (updateUserDto.password) {
            updates['showpassword'] = updateUserDto.password;
            updates.password = await bcrypt.hash(updateUserDto.password, 10);
        }

        updates.updatedAt = { $date: new Date().toISOString() };

        const result: any = await this.prisma.$runCommandRaw({
            update: 'User',
            updates: [
                {
                    q: { _id: { $oid: id } },
                    u: { $set: updates }
                }
            ]
        });

        if (result.n === 0) {
            throw new BadRequestException('ບໍ່ພົບຜູ້ໃຊ້');
        }

        return this.prisma.user.findUnique({ where: { id } });
    }

    async remove(agentId: string, userIds: string[]) {
        const ids = Array.isArray(userIds) ? userIds : [userIds];

        const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
        if (!agent) {
            throw new BadRequestException('ບໍ່ພົບຕົວແທນ');
        }

        const users = await this.prisma.user.findMany({
            where: {
                id: { in: ids },
                agentId: agentId
            },
            select: { id: true, amount: true }
        });

        if (users.length === 0) {
            throw new BadRequestException('ບໍ່ພົບຜູ້ໃຊ້ທີ່ເປັນຂອງຕົວແທນ');
        }

        const timestamp = new Date().toISOString();
        let totalRefund = 0;
        const userUpdates: any[] = [];

        for (const user of users) {
            totalRefund += user.amount;

            // Prepare User Soft Delete (Update)
            userUpdates.push({
                q: { _id: { $oid: user.id } },
                u: {
                    $set: {
                        delete: true,        // Mark as deleted
                        status: false,       // Disable login
                        amount: 0.0,         // Clear balance
                        updatedAt: { $date: timestamp }
                    }
                }
            });
        }

        // 1. Update Agent (Refund)
        if (totalRefund > 0) {
            await this.prisma.$runCommandRaw({
                update: 'Agent',
                updates: [
                    {
                        q: { _id: { $oid: agentId } },
                        u: { $set: { amount: agent.amount + totalRefund, updatedAt: { $date: timestamp } } }
                    }
                ]
            });
        }

        // 2. Soft Delete Users (Update instead of Delete)
        await this.prisma.$runCommandRaw({
            update: 'User',
            updates: userUpdates
        });

        return {
            status: 'ok',
            message: `ລົບຜູ້ໃຊ້ ${users.length} ຄົນສຳເລັດ`,
            data: {
                deletedCount: users.length,
                totalRefund
            }
        };
    }

    async deposit(userIds: string[], amount: number, agentId: string) {
        // Ensure userIds is an array
        const ids = Array.isArray(userIds) ? userIds : [userIds];

        if (!amount || amount <= 0) {
            throw new BadRequestException('ຈຳນວນເງິນຕ້ອງຫຼາຍກວ່າ 0');
        }

        const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
        if (!agent) throw new BadRequestException('ບໍ່ພົບຕົວແທນ');

        const users = await this.prisma.user.findMany({
            where: {
                id: { in: ids },
                agentId: agentId
            },
            select: { id: true, username: true, amount: true }
        });

        if (users.length !== ids.length) {
            throw new BadRequestException('ບາງຜູ້ໃຊ້ບໍ່ພົບ ຫຼື ບໍ່ໄດ້ເປັນຂອງຕົວແທນ');
        }

        const totalAmount = amount * users.length;
        if (agent.amount < totalAmount) {
            throw new BadRequestException('ຍອດເງິນຕົວແທນບໍ່ພຽງພໍ');
        }

        const timestamp = new Date().toISOString();
        const userUpdates: any[] = [];
        const historyInserts: any[] = [];

        for (const user of users) {
            const before = user.amount;
            const after = before + amount;

            // Prepare User Update
            userUpdates.push({
                q: { _id: { $oid: user.id } },
                u: { $set: { amount: after, updatedAt: { $date: timestamp } } }
            });

            // Prepare History Insert
            historyInserts.push({
                userId: { $oid: user.id },
                agentId: { $oid: agentId },
                amount: amount,
                before_amount: before,
                after_amount: after,
                type: 'DEPOSIT',
                date: { $date: timestamp },
            });
        }

        // 1. Update Agent
        await this.prisma.$runCommandRaw({
            update: 'Agent',
            updates: [
                {
                    q: { _id: { $oid: agentId } },
                    u: { $set: { amount: agent.amount - totalAmount, updatedAt: { $date: timestamp } } }
                }
            ]
        });

        // 2. Update Users
        await this.prisma.$runCommandRaw({
            update: 'User',
            updates: userUpdates
        });

        // 3. Insert History
        await this.prisma.$runCommandRaw({
            insert: 'UserHistory',
            documents: historyInserts
        });

        return {
            status: 'ok',
            message: 'ຝາກເງິນສຳເລັດ',
            data: {
                totalUsers: users.length,
                totalAmount
            }
        };
    }

    async withdraw(userId: string, amount: number, agentId: string) {
        if (!amount || amount <= 0) {
            throw new BadRequestException('ຈຳນວນເງິນຕ້ອງຫຼາຍກວ່າ 0');
        }
        const userResp = await this.findOne(userId);
        const user = userResp.data;
        const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
        if (!user || !agent) throw new BadRequestException('ບໍ່ພົບຜູ້ໃຊ້ ຫຼື ຕົວແທນ');
        if (user.agentId !== agentId) throw new BadRequestException('ຜູ້ໃຊ້ບໍ່ໄດ້ເປັນຂອງຕົວແທນ');

        if (user.amount < amount) throw new BadRequestException('ຍອດເງິນຜູ້ໃຊ້ບໍ່ພຽງພໍ');

        const timestamp = new Date().toISOString();
        const userBefore = user.amount;
        const userAfter = userBefore - amount;

        const agentBefore = agent.amount;
        const agentAfter = agentBefore + amount;

        // 1. Update Agent (Increase balance)
        await this.prisma.$runCommandRaw({
            update: 'Agent',
            updates: [
                {
                    q: { _id: { $oid: agentId } },
                    u: { $set: { amount: agentAfter, updatedAt: { $date: timestamp } } }
                }
            ]
        });

        // 2. Update User (Decrease balance)
        await this.prisma.$runCommandRaw({
            update: 'User',
            updates: [
                {
                    q: { _id: { $oid: userId } },
                    u: { $set: { amount: userAfter, updatedAt: { $date: timestamp } } }
                }
            ]
        });

        // 3. Insert History
        await this.prisma.$runCommandRaw({
            insert: 'UserHistory',
            documents: [
                {
                    userId: { $oid: userId },
                    agentId: { $oid: agentId },
                    amount: amount,
                    before_amount: userBefore,
                    after_amount: userAfter,
                    type: 'WITHDRAW',
                    date: { $date: timestamp }
                }
            ]
        });

        return { status: 'ok', message: 'ຖອນເງິນສຳເລັດ' };
    }

    async getHistory(userId: string, page: number = 1, limit: number = 10, startDate?: string, endDate?: string) {
        const pageNumber = Math.max(1, Number(page));
        const limitNumber = Math.max(1, Number(limit));
        const skip = (pageNumber - 1) * limitNumber;

        const where: any = { userId };

        if (startDate || endDate) {
            where.date = {};
            if (startDate) {
                where.date['gte'] = new Date(startDate);
            }
            if (endDate) {
                where.date['lte'] = new Date(endDate);
            }
        }

        const [items, totalItems] = await Promise.all([
            this.prisma.userHistory.findMany({
                where,
                skip,
                take: limitNumber,
                orderBy: { date: 'desc' }
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

    async getBetTransactions(userId: string, page: number = 1, limit: number = 10) {
        const pageNumber = Math.max(1, Number(page));
        const limitNumber = Math.max(1, Number(limit));
        const skip = (pageNumber - 1) * limitNumber;

        const where: any = { userId };

        const [items, totalItems] = await Promise.all([
            this.prisma.betTransaction.findMany({
                where,
                skip,
                take: limitNumber,
                orderBy: { createdAt: 'desc' }
            }),
            this.prisma.betTransaction.count({ where })
        ]);

        return {
            items,
            totalItems,
            currentPage: pageNumber,
            totalPages: Math.ceil(totalItems / limitNumber)
        };
    }

    async blockUsers(agentId: string, userIds: string[]) {
        const ids = Array.isArray(userIds) ? userIds : [userIds];

        const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
        if (!agent) throw new BadRequestException('ບໍ່ພົບຕົວແທນ');

        const users = await this.prisma.user.findMany({
            where: {
                id: { in: ids },
                agentId: agentId
            },
            select: { id: true, username: true, amount: true, status: true }
        });

        if (users.length === 0) {
            throw new BadRequestException('ບໍ່ພົບຜູ້ໃຊ້ທີ່ເປັນຂອງຕົວແທນ');
        }

        // Filter users who are already blocked
        const activeUsers = users.filter(u => u.status !== false);
        const alreadyBlockedCount = users.length - activeUsers.length;

        if (activeUsers.length === 0) {
            return {
                status: 'ok',
                message: `ຜູ້ໃຊ້ທັງໝົດ ${users.length} ຄົນຖືກບລັອກແລ້ວ`,
                data: {
                    totalRefund: 0,
                    blockedCount: 0,
                    alreadyBlockedCount
                }
            };
        }

        const timestamp = new Date().toISOString();
        const userUpdates: any[] = [];
        const historyInserts: any[] = [];
        let totalRefund = 0;

        for (const user of activeUsers) {
            // 1. Calculate Refund (User amount -> Agent)
            const refundAmount = user.amount;
            totalRefund += refundAmount;

            // 2. Generate Random 5-digit Password
            const password = Math.floor(10000 + Math.random() * 90000).toString();
            const hashedPassword = await bcrypt.hash(password, 10);

            // 3. Prepare User Update: status=false, isOnline=false, amount=0, password=new
            userUpdates.push({
                q: { _id: { $oid: user.id } },
                u: {
                    $set: {
                        status: false,
                        isOnline: false,
                        amount: 0.0,
                        password: hashedPassword,
                        showpassword: password,
                        updatedAt: { $date: timestamp }
                    }
                }
            });

            // 4. Prepare History: Type=BLOCK ONLY if amount > 0
            if (user.amount > 0) {
                historyInserts.push({
                    userId: { $oid: user.id },
                    agentId: { $oid: agentId },
                    amount: refundAmount,
                    before_amount: user.amount,
                    after_amount: 0.0,
                    type: 'WITHDRAW',
                    date: { $date: timestamp },
                    status: true
                });
            }
        }

        // 5. Update Agent (Refund)
        if (totalRefund > 0) {
            await this.prisma.$runCommandRaw({
                update: 'Agent',
                updates: [
                    {
                        q: { _id: { $oid: agentId } },
                        u: { $set: { amount: agent.amount + totalRefund, updatedAt: { $date: timestamp } } }
                    }
                ]
            });
        }

        // 6. Update Users
        if (userUpdates.length > 0) {
            await this.prisma.$runCommandRaw({
                update: 'User',
                updates: userUpdates
            });
        }

        // 7. Insert History
        if (historyInserts.length > 0) {
            await this.prisma.$runCommandRaw({
                insert: 'UserHistory',
                documents: historyInserts
            });
        }

        // 8. Update Redis Cache (Force Sync to 0)
        // CRITICAL FIX: Iterate over ALL targeted users, not just activeUsers.
        // This ensures that if a user was "already blocked" but had stale Redis balance, they get fixed.
        for (const user of users) {
            try {
                // Force sync balance to 0
                await this.redisClient.set(`balance:${user.username.toLowerCase()}`, 0);
            } catch (e) {
                console.error(`Failed to update Redis for user ${user.username}:`, e);
            }
        }

        return {
            status: 'ok',
            message: `ບລັອກຜູ້ໃຊ້ ${activeUsers.length} ຄົນສຳເລັດ. ຜູ້ໃຊ້ ${alreadyBlockedCount} ຄົນຖືກບລັອກແລ້ວ.`,
            data: {
                totalRefund,
                blockedCount: activeUsers.length,
                alreadyBlockedCount
            }
        };
    }

    async unblockUsers(agentId: string, userIds: string[]) {
        const ids = Array.isArray(userIds) ? userIds : [userIds];

        const users = await this.prisma.user.findMany({
            where: {
                id: { in: ids },
                agentId: agentId
            },
            select: { id: true, username: true, amount: true }
        });

        if (users.length === 0) {
            throw new BadRequestException('ບໍ່ພົບຜູ້ໃຊ້ທີ່ເປັນຂອງຕົວແທນ');
        }

        const timestamp = new Date().toISOString();
        const userUpdates: any[] = [];

        for (const user of users) {
            // 1. Update DB Status
            userUpdates.push({
                q: { _id: { $oid: user.id } },
                u: { $set: { status: true, updatedAt: { $date: timestamp } } }
            });

            // 2. Sync Redis Cache (Force Update)
            try {
                // Eagerly set the correct balance from DB
                const balance = Number(user.amount);
                await this.redisClient.set(`balance:${user.username.toLowerCase()}`, balance);
            } catch (e) {
                console.error(`Failed to update Redis for user ${user.username}:`, e);
            }
        }

        await this.prisma.$runCommandRaw({
            update: 'User',
            updates: userUpdates
        });

        return {
            status: 'ok',
            message: `ປົດບລັອກຜູ້ໃຊ້ ${users.length} ຄົນສຳເລັດ`
        };
    }

    async resetPassword(agentId: string, userIds: string[]) {
        if (!userIds || userIds.length === 0) {
            throw new BadRequestException('ບໍ່ໄດ້ລະບຸ ID ຜູ້ໃຊ້');
        }

        const users = await this.prisma.user.findMany({
            where: {
                id: { in: userIds },
                agentId: agentId
            }
        });

        if (users.length !== userIds.length) {
            throw new BadRequestException('ບໍ່ພົບຜູ້ໃຊ້ໜຶ່ງຄົນ ຫຼື ຫຼາຍຄົນ ຫຼື ບໍ່ໄດ້ເປັນຂອງທ່ານ');
        }

        const results: any[] = [];

        for (const user of users) {
            let newPassword = '';
            let isUnique = false;
            let retries = 0;

            while (!isUnique && retries < 10) {
                newPassword = Math.floor(10000 + Math.random() * 90000).toString();
                const existing = await this.prisma.user.findFirst({
                    where: { showpassword: newPassword }
                });

                if (!existing) {
                    isUnique = true;
                }
                retries++;
            }

            if (!isUnique) {
                throw new Error('ບໍ່ສາມາດສ້າງລະຫັດຜ່ານທີ່ບໍ່ຊ້ຳກັນໄດ້ຫຼັງຈາກລອງໃໝ່');
            }

            const hashedPassword = await bcrypt.hash(newPassword, 10);

            await this.prisma.$runCommandRaw({
                update: 'User',
                updates: [
                    {
                        q: { _id: { $oid: user.id } },
                        u: {
                            $set: {
                                password: hashedPassword,
                                showpassword: newPassword,
                                updatedAt: { $date: new Date().toISOString() }
                            }
                        }
                    }
                ]
            });

            results.push({
                id: user.id,
                username: user.username,
                newPassword: newPassword
            });
        }

        return results;
    }
    async getTopTransactors(agentId: string) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 7);

        // Fetch history for the last 7 days for this agent
        const history = await this.prisma.userHistory.findMany({
            where: {
                agentId: agentId,
                date: {
                    gte: startDate,
                    lte: endDate
                }
            },
            select: { userId: true, amount: true, type: true }
        });

        const stats = new Map<string, {
            deposit: number;
            withdraw: number;
            depositCount: number;
            withdrawCount: number;
        }>();

        // Aggregate locally
        for (const record of history) {
            if (!stats.has(record.userId)) {
                stats.set(record.userId, {
                    deposit: 0,
                    withdraw: 0,
                    depositCount: 0,
                    withdrawCount: 0
                });
            }
            const entry = stats.get(record.userId);
            if (entry) { // TS check
                if (record.type === 'DEPOSIT') {
                    entry.deposit += record.amount;
                    entry.depositCount += 1;
                } else if (record.type === 'WITHDRAW') {
                    entry.withdraw += record.amount;
                    entry.withdrawCount += 1;
                }
            }
        }

        const aggregated = Array.from(stats.entries()).map(([userId, data]) => ({
            userId,
            ...data
        }));

        // Get Top 5 Deposits
        const topDeposits = aggregated
            .filter(a => a.deposit > 0)
            .sort((a, b) => b.deposit - a.deposit)
            .slice(0, 5);

        // Get Top 5 Withdrawals
        const topWithdrawals = aggregated
            .filter(a => a.withdraw > 0)
            .sort((a, b) => b.withdraw - a.withdraw)
            .slice(0, 5);

        // Collect all User IDs to fetch details
        const userIds = new Set([...topDeposits.map(x => x.userId), ...topWithdrawals.map(x => x.userId)]);

        const users = await this.prisma.user.findMany({
            where: { id: { in: Array.from(userIds) } },
            select: { id: true, username: true } // Removed nickName
        });

        const userMap = new Map(users.map(u => [u.id, u]));

        const formatResult = (list, type: 'deposit' | 'withdraw') => list.map(item => ({
            userId: item.userId,
            amount: type === 'deposit' ? item.deposit : item.withdraw,
            transactions: type === 'deposit' ? item.depositCount : item.withdrawCount,
            username: userMap.get(item.userId)?.username || 'Unknown',
        }));

        return {
            topDeposits: formatResult(topDeposits, 'deposit'),
            topWithdrawals: formatResult(topWithdrawals, 'withdraw'),
            startDate,
            endDate
        };
    }
    async getUserCounts(agentId: string) {
        const [totalUsers, onlineUsers] = await Promise.all([
            this.prisma.user.count({ where: { agentId } }),
            this.prisma.user.count({ where: { agentId, isOnline: true } })
        ]);

        return {
            totalUsers,
            onlineUsers
        };
    }
    async getFinancialStats(agentId: string, startDate?: string, endDate?: string) {
        let start = startDate ? new Date(startDate) : new Date();
        let end = endDate ? new Date(endDate) : new Date();

        if (!startDate) {
            start.setHours(0, 0, 0, 0);
        }
        if (!endDate) {
            end.setHours(23, 59, 59, 999);
        }

        const [history, agent] = await Promise.all([
            this.prisma.userHistory.findMany({
                where: {
                    agentId: agentId,
                    date: {
                        gte: start,
                        lte: end
                    }
                },
                select: { amount: true, type: true, date: true }
            }),
            this.prisma.agent.findUnique({
                where: { id: agentId },
                select: { percent: true }
            })
        ]);

        let totalDeposit = 0;
        let totalWithdraw = 0;
        let totalTransactions = 0;

        const dailyStats = new Map<string, { date: string, transactions: number, deposit: number, withdraw: number, income: number }>();

        // Pre-fill days if needed? 
        // User asked for "changing over time". If range is large, daily. If single day, maybe hourly?
        // Let's stick to simple aggregation of existing data points first to avoid complex date looping logic unless explicitly needed.
        // Actually, user example: "12/02-15/02". This is multi-day. So grouping by day is appropriate.

        for (const record of history) {
            if (!record.date) continue;
            // Group by YYYY-MM-DD
            const dateKey = record.date.toISOString().split('T')[0];

            if (!dailyStats.has(dateKey)) {
                dailyStats.set(dateKey, {
                    date: dateKey,
                    transactions: 0,
                    deposit: 0,
                    withdraw: 0,
                    income: 0
                });
            }

            const entry = dailyStats.get(dateKey);
            if (entry) {
                entry.transactions += 1;
                totalTransactions += 1;

                if (record.type === 'DEPOSIT') {
                    entry.deposit += record.amount;
                    totalDeposit += record.amount;
                } else if (record.type === 'WITHDRAW') {
                    entry.withdraw += record.amount;
                    totalWithdraw += record.amount;
                }
                // Income per day
                entry.income = entry.deposit - entry.withdraw;
            }
        }

        const totalIncome = totalDeposit - totalWithdraw;
        const percent = agent?.percent || 0;
        const agentIncome = totalIncome * (percent / 100);
        const providerIncome = totalIncome - agentIncome;

        // Convert Map to sorted array
        // const chart = Array.from(dailyStats.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        return {
            summary: {
                transactions: totalTransactions,
                deposit: totalDeposit,
                withdraw: totalWithdraw,
                income: totalIncome, // Gross Income
                agentIncome,
                providerIncome
            },
            // chart,
            startDate: start,
            endDate: end
        };
    }
}
