import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, UnauthorizedException, Query } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('agents')
export class AgentsController {
    constructor(private readonly agentsService: AgentsService) { }

    @Roles('admin')
    @Post()
    create(@Body() createAgentDto: CreateAgentDto) {
        return this.agentsService.create(createAgentDto);
    }

    @Roles('admin')
    @Get(

    )
    findAll(@Query('page') page: number = 1, @Query('limit') limit: number = 10) {
        return this.agentsService.findAll(Number(page), Number(limit));
    }

    @Roles('admin')
    @Get('stats/admin')
    getAdminStats(
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string
    ) {
        return this.agentsService.getAdminStats(startDate, endDate);
    }

    @Roles('admin', 'agent')
    @Get(':id')
    async findOne(@Param('id') id: string, @Req() req) {
        if (req.user.role === 'agent' && req.user.userId !== id) {
            throw new UnauthorizedException();
        }
        return this.agentsService.findOne(id);
    }

    @Roles('admin')
    @Patch(':id')
    update(@Param('id') id: string, @Body() updateAgentDto: UpdateAgentDto) {
        return this.agentsService.update(id, updateAgentDto);
    }

    @Roles('admin')
    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.agentsService.remove(id);
    }

    @Roles('admin')
    @Post(':id/deposit')
    deposit(@Param('id') id: string, @Body('amount') amount: number) {
        return this.agentsService.deposit(id, Number(amount));
    }

    @Roles('admin')
    @Post(':id/withdraw')
    withdraw(@Param('id') id: string, @Body('amount') amount: number) {
        return this.agentsService.withdraw(id, Number(amount));
    }

    @Roles('admin', 'agent')
    @Get(':id/history')
    getHistory(
        @Param('id') id: string,
        @Req() req,
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 10,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string
    ) {
        if (req.user.role === 'agent' && req.user.userId !== id) {
            throw new UnauthorizedException();
        }
        return this.agentsService.getHistory(id, Number(page), Number(limit), startDate, endDate);
    }



    @Roles('admin')
    @Patch(':id/block')
    block(@Param('id') id: string, @Body('reason') reason?: string) {
        return this.agentsService.block(id, reason);
    }

    @Roles('admin')
    @Patch(':id/unblock')
    unblock(@Param('id') id: string, @Body('reason') reason?: string) {
        return this.agentsService.unblock(id, reason);
    }

    @Roles('admin', 'agent')
    @Get(':id/users-history')
    getUsersHistory(
        @Param('id') id: string,
        @Req() req,
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 10
    ) {
        if (req.user.role === 'agent' && req.user.userId !== id) {
            throw new UnauthorizedException();
        }
        return this.agentsService.getHistoryUserByAgentId(id, Number(page), Number(limit));
    }
}



