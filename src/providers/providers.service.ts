
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../common/s3.service';
import { Provider, Prisma, CategoryCode } from '@prisma/client';

@Injectable()
export class ProvidersService {
    constructor(
        private prisma: PrismaService,
        private s3Service: S3Service,
    ) { }

    async create(data: any, file: Express.Multer.File): Promise<Provider> {
        const existingProvider = await this.prisma.provider.findUnique({
            where: { productId: data.productId },
        });

        if (existingProvider) {
            throw new BadRequestException(`ລະຫັດ provider '${data.productId}' ນີ້ມີຢູ່ແລ້ວ.`);
        }

        const imageUrl = await this.s3Service.uploadFile(file, 'providers');

        return this.prisma.provider.create({
            data: {
                productId: data.productId,
                productName: data.productName,
                img: imageUrl,
                status: data.status === 'true' || data.status === true,
                category: data.category as CategoryCode,
                rank: data.rank !== undefined ? +data.rank : undefined,
            },
        });
    }

    async findAll(page: number, limit: number, category?: string) {
        const skip = (page - 1) * limit;
        const where: Prisma.ProviderWhereInput = {};

        if (category) {
            where.category = category as CategoryCode;
        }

        const [data, total] = await Promise.all([
            this.prisma.provider.findMany({
                where,
                skip,
                take: limit,
                orderBy: [
                    { rank: 'asc' },
                    { createdAt: 'desc' }
                ],
            }),
            this.prisma.provider.count({ where }),
        ]);

        return {
            data,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async findAllPublic(category?: string) {
        const where: Prisma.ProviderWhereInput = {
            status: true, // Chỉ lấy provider có status = true
        };

        if (category) {
            where.category = category as CategoryCode;
        }

        // Return all matching records
        const data = await this.prisma.provider.findMany({
            where,
            orderBy: [
                { rank: 'asc' },
                { createdAt: 'desc' }
            ],
        });

        return {
            data,
        };
    }



    async findOne(id: string): Promise<Provider> {
        const provider = await this.prisma.provider.findFirst({
            where: {
                id,
            },
        });
        if (!provider) {
            throw new NotFoundException(`ບໍ່ພົບຜູ້ໃຫ້ບໍລິການທີ່ມີ ID ${id} ນີ້.`);
        }
        return provider;
    }

    async update(id: string, data: any, file?: Express.Multer.File): Promise<Provider> {
        // console.log('Update Provider Data:', data);
        const provider = await this.findOne(id);

        let imageUrl = provider.img;
        if (file) {
            // Upload new image
            imageUrl = await this.s3Service.uploadFile(file, 'providers');
        }

        return this.prisma.provider.update({
            where: { id },
            data: {
                productId: data.productId,
                productName: data.productName,
                img: imageUrl,
                status: data.status !== undefined ? (data.status === 'true' || data.status === true) : undefined,
                category: data.category ? (data.category as CategoryCode) : undefined,
                rank: data.rank !== undefined ? +data.rank : undefined,
            },
        });
    }

    async updateStatus(id: string, status: boolean): Promise<Provider> {
        await this.findOne(id);
        return this.prisma.provider.update({
            where: { id },
            data: { status },
        });
    }
}
