import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AdminsService {
    constructor(private prisma: PrismaService) { }

    // async create(createAdminDto: CreateAdminDto) {
    //     const hashedPassword = await bcrypt.hash(createAdminDto.password, 10);
    //     return this.prisma.admin.create({
    //         data: {
    //             ...createAdminDto,
    //             password: hashedPassword,
    //         },
    //     });
    // }

    // findAll() {
    //     return this.prisma.admin.findMany({
    //         select: {
    //             id: true,
    //             username: true,
    //             role: true,
    //             status: true,
    //             createdAt: true,
    //             updatedAt: true,
    //         },
    //     });
    // }

    // findOne(id: string) {
    //     return this.prisma.admin.findUnique({
    //         where: { id },
    //         select: {
    //             id: true,
    //             username: true,
    //             role: true,
    //             status: true,
    //             createdAt: true,
    //             updatedAt: true,
    //         },
    //     });
    // }

    // async update(id: string, updateAdminDto: UpdateAdminDto) {
    //     if (updateAdminDto.password) {
    //         updateAdminDto.password = await bcrypt.hash(updateAdminDto.password, 10);
    //     }
    //     return this.prisma.admin.update({
    //         where: { id },
    //         data: updateAdminDto,
    //     });
    // }

    // remove(id: string) {
    //     return this.prisma.admin.delete({ where: { id } });
    // }
}
