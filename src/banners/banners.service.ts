
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../common/s3.service';
import { Banner } from '@prisma/client';

@Injectable()
export class BannersService {
    constructor(
        private prisma: PrismaService,
        private s3Service: S3Service,
    ) { }

    async create(data: any, file: Express.Multer.File): Promise<Banner> {
        const imageUrl = await this.s3Service.uploadFile(file, 'banners');

        // Handle status conversion
        const status = data.status === 'true' || data.status === true;

        return this.prisma.banner.create({
            data: {
                bannerName: data.bannerName,
                img: imageUrl,
                status: status,
            },
        });
    }

    async findAll(page: number, limit: number) {
        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
            this.prisma.banner.findMany({
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.banner.count(),
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

    async findOne(id: string): Promise<Banner> {
        const banner = await this.prisma.banner.findFirst({
            where: {
                id,
            },
        });
        if (!banner) {
            throw new NotFoundException(`ບໍ່ພົບແບນເນີທີ່ມີ ID ${id} ນີ້.`);
        }
        return banner;
    }

    async update(id: string, data: any, file?: Express.Multer.File): Promise<Banner> {
        const banner = await this.findOne(id);

        let imageUrl = banner.img;
        if (file) {
            imageUrl = await this.s3Service.uploadFile(file, 'banners');
        }

        const status = data.status !== undefined ? (data.status === 'true' || data.status === true) : undefined;

        return this.prisma.banner.update({
            where: { id },
            data: {
                bannerName: data.bannerName,
                img: imageUrl,
                status: status,
            },
        });
    }

    async updateStatus(id: string, status: boolean): Promise<Banner> {
        await this.findOne(id);
        return this.prisma.banner.update({
            where: { id },
            data: { status },
        });
    }
}
