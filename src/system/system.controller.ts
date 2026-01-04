import { Controller, Get, Post, Body, UseGuards, Req, UnauthorizedException, BadRequestException, Query } from '@nestjs/common';
import { SystemService } from './system.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('system')
export class SystemController {
    constructor(private readonly systemService: SystemService) { }

    @Get('status')
    getStatus() {
        return this.systemService.getStatus();
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    @Post('status/toggle')
    async updateStatus() {
        // No input required. Toggles the status via service.
        return this.systemService.updateStatus(true);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    @Post('status/open')
    async openSystem() {
        return this.systemService.updateStatus(false);
    }
}
