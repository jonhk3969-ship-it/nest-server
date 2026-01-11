
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
import { BannersService } from './banners.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';

@Controller('banners')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class BannersController {
    constructor(private readonly bannersService: BannersService) { }

    @Post()
    @UseInterceptors(FileInterceptor('file'))
    async create(
        @Body() createBannerDto: any,
        @UploadedFile() file: Express.Multer.File,
    ) {
        if (!file) {
            throw new BadRequestException('ກະລຸນາອັບໂຫຼດຮູບພາບ.');
        }

        const data = {
            ...createBannerDto,
        };

        return this.bannersService.create(data, file);
    }

    @Get()
    @Public()
    findAll(
        @Query('page') page: string = '1',
        @Query('limit') limit: string = '10',
    ) {
        return this.bannersService.findAll(+page, +limit);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.bannersService.findOne(id);
    }

    @Patch(':id')
    @UseInterceptors(FileInterceptor('file'))
    update(
        @Param('id') id: string,
        @Body() updateBannerDto: any,
        @UploadedFile() file?: Express.Multer.File,
    ) {
        return this.bannersService.update(id, updateBannerDto, file);
    }

    @Patch(':id/status')
    updateStatus(
        @Param('id') id: string,
        @Body('status') status: boolean,
    ) {
        return this.bannersService.updateStatus(id, status);
    }
}
