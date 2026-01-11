
import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseInterceptors,
    UploadedFile,
    BadRequestException,
    UseGuards,
    Query,
} from '@nestjs/common';
import { ProvidersService } from './providers.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { Provider, Prisma, Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';

@Controller('providers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class ProvidersController {
    constructor(private readonly providersService: ProvidersService) { }

    @Post()
    @UseInterceptors(FileInterceptor('file'))
    async create(
        @Body() createProviderDto: any, // Using any for now, ideally strictly typed DTO
        @UploadedFile() file: Express.Multer.File,
    ) {
        if (!file) {
            throw new BadRequestException('ກະລຸນາອັບໂຫຼດຮູບພາບ.');
        }

        const data = {
            ...createProviderDto,
        };

        return this.providersService.create(data, file);
    }

    @Get()
    findAll(
        @Query('page') page: string = '1',
        @Query('limit') limit: string = '10',
        @Query('category') category?: string,
    ) {
        return this.providersService.findAll(+page, +limit, category);
    }

    @Get('list')
    @Public()
    findAllPublic(
        @Query('category') category?: string,
    ) {
        return this.providersService.findAllPublic(category);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.providersService.findOne(id);
    }

    @Patch(':id')
    @UseInterceptors(FileInterceptor('file'))
    update(
        @Param('id') id: string,
        @Body() updateProviderDto: any,
        @UploadedFile() file?: Express.Multer.File,
    ) {
        return this.providersService.update(id, updateProviderDto, file);
    }

    @Patch(':id/status')
    updateStatus(
        @Param('id') id: string,
        @Body('status') status: boolean,
    ) {
        return this.providersService.updateStatus(id, status);
    }
}
