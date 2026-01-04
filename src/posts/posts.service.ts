import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PostsService {
    constructor(private prisma: PrismaService) { }

    async create(title: string, description: string) {
        const doc: any = {
            title,
            description,
            createdAt: { $date: new Date().toISOString() },
            updatedAt: { $date: new Date().toISOString() },
        };

        await this.prisma.$runCommandRaw({
            insert: 'Post',
            documents: [doc]
        });

        // Return created document (simulated default fetch)
        // Since we don't have the ID easily from insert command in one go without driver specifics,
        // we can return the data provided or fetch latest.
        // For simplicity and performance, returning what we inserted (minus ID) is often enough for confirmation,
        // or we fetch the latest created post.
        return { success: true, message: 'Post created', data: doc };
    }

    async findAll() {
        // Use raw find command
        const result: any = await this.prisma.$runCommandRaw({
            find: 'Post',
            filter: {},
            sort: { createdAt: -1 } // Newest first
        });

        const items = result?.cursor?.firstBatch || [];

        // Map _id to id for frontend consistency if needed
        return items.map((item: any) => ({
            id: item._id.$oid,
            title: item.title,
            description: item.description,
            createdAt: item.createdAt.$date,
            updatedAt: item.updatedAt.$date,
        }));
    }

    async remove(id: string) {
        await this.prisma.$runCommandRaw({
            delete: 'Post',
            deletes: [
                {
                    q: { _id: { $oid: id } },
                    limit: 1
                }
            ]
        });
        return { success: true, message: 'Post deleted' };
    }

    async removeAll() {
        await this.prisma.$runCommandRaw({
            delete: 'Post',
            deletes: [
                {
                    q: {},
                    limit: 0 // 0 means delete all
                }
            ]
        });
        return { success: true, message: 'All posts deleted' };
    }
}
