import { Controller, Get, Body, Patch, Param, Delete, UseGuards, UnauthorizedException, Req } from '@nestjs/common';
import { AdminsService } from './admins.service';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admins')
export class AdminsController {
    constructor(private readonly adminsService: AdminsService) { }

    // Create endpoint removed to restricted admin creation to server-side seeding only

    // @Roles('admin')
    // @Get()
    // findAll() {
    //     return this.adminsService.findAll();
    // }

    // @Roles('admin')
    // @Get('profile')
    // getProfile(@Req() req) {
    //     return this.adminsService.findOne(req.user.userId);
    // }

    // @Roles('admin')
    // @Get(':id')
    // findOne(@Param('id') id: string) {
    //     return this.adminsService.findOne(id);
    // }

    // @Roles('admin')
    // @Patch(':id')
    // update(@Param('id') id: string, @Body() updateAdminDto: UpdateAdminDto) {
    //     return this.adminsService.update(id, updateAdminDto);
    // }

    // @Roles('admin')
    // @Delete(':id')
    // remove(@Param('id') id: string) {
    //     return this.adminsService.remove(id);
    // }
}
