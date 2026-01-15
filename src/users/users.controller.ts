import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, UnauthorizedException, Query, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateBulkUsersDto } from './dto/create-bulk-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Roles('agent')
    @Post('bulk')
    createBulk(@Body() createBulkUsersDto: CreateBulkUsersDto, @Req() req) {
        if (createBulkUsersDto.agentId !== req.user.userId && req.user.role !== 'admin') {
            createBulkUsersDto.agentId = req.user.userId;
        }
        return this.usersService.createBulk(createBulkUsersDto);
    }



    @Roles('agent')
    @Get()
    findAll(
        @Req() req,
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 10,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('search') search?: string,
    ) {
        if (search) {
            return this.usersService.searchByAgent(req.user.userId, search);
        }
        return this.usersService.findAllByAgent(req.user.userId, Number(page), Number(limit), startDate, endDate);
    }

    @Roles('admin')
    @Get('agent/:id')
    getUsersByAgent(
        @Param('id') id: string,
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 10,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('search') search?: string,
    ) {
        if (search) {
            return this.usersService.searchByAgent(id, search, Number(page), Number(limit));
        }
        return this.usersService.findAllByAgent(id, Number(page), Number(limit), startDate, endDate);
    }




    @Roles('agent')
    @Patch(':id')
    update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
        return this.usersService.update(id, updateUserDto);
    }

    @Roles('agent')
    @Post('delete')
    remove(@Body('userIds') userIds: string[], @Req() req) {
        return this.usersService.remove(req.user.userId, userIds);
    }

    @Roles('agent')
    @Post('deposit')
    deposit(@Body('userIds') userIds: string[], @Body('amount') amount: number, @Req() req) {
        return this.usersService.deposit(userIds, Number(amount), req.user.userId);
    }

    @Roles('agent')
    @Post(':id/withdraw')
    withdraw(@Param('id') id: string, @Body('amount') amount: number, @Req() req) {
        return this.usersService.withdraw(id, Number(amount), req.user.userId);
    }

    @Roles('agent')
    @Post('reset-password')
    resetPassword(@Req() req, @Body() body: { userIds: string[] }) {
        return this.usersService.resetPassword(req.user.userId, body.userIds);
    }

    @Roles('agent')
    @Get('stats/top-transactors')
    getTopTransactors(@Req() req) {
        return this.usersService.getTopTransactors(req.user.userId);
    }

    @Roles('agent')
    @Get('stats/counts')
    getUserCounts(@Req() req) {
        return this.usersService.getUserCounts(req.user.userId);
    }

    @Roles('agent')
    @Get('stats/financial')
    getFinancialStats(
        @Req() req,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string
    ) {
        return this.usersService.getFinancialStats(req.user.userId, startDate, endDate);
    }

    @Roles('agent', 'user', 'admin')
    @Get('amount')
    getAmount(@Req() req) {
        return this.usersService.getAmount(req.user.userId);
    }

    @Roles('admin', 'agent', 'user')
    @Get(':id/history')
    async getHistory(
        @Param('id') id: string,
        @Req() req,
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 10,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        const userResp = await this.usersService.findOne(id);
        const user = userResp.data;
        if (!user) throw new UnauthorizedException('User not found');

        if (req.user.role === 'user' && req.user.userId !== id) throw new UnauthorizedException();
        if (req.user.role === 'agent' && user.agentId !== req.user.userId) throw new UnauthorizedException();

        return this.usersService.getHistory(id, Number(page), Number(limit), startDate, endDate);
    }

    @Roles('admin', 'agent', 'user')
    @Get(':id/bet-transactions')
    async getBetTransactions(
        @Param('id') id: string,
        @Req() req,
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 10,
    ) {
        const userResp = await this.usersService.findOne(id);
        const user = userResp.data;
        if (!user) throw new UnauthorizedException('User not found');

        // Authorization check
        if (req.user.role === 'user' && req.user.userId !== id) throw new UnauthorizedException();
        if (req.user.role === 'agent' && user.agentId !== req.user.userId) throw new UnauthorizedException();

        return this.usersService.getBetTransactions(id, Number(page), Number(limit));
    }
    @Roles('agent')
    @Post('block')
    block(@Body('userIds') userIds: string[], @Req() req) {
        return this.usersService.blockUsers(req.user.userId, userIds);
    }

    @Roles('agent')
    @Post('unblock')
    unblock(@Body('userIds') userIds: string[], @Req() req) {
        return this.usersService.unblockUsers(req.user.userId, userIds);
    }

    @Roles('agent', 'user', 'admin')
    @Get(':id')
    async findOne(@Param('id') id: string, @Req() req) {
        const userResp = await this.usersService.findOne(id);
        const user = userResp.data;
        if (!user) return null;

        if (req.user.role === 'user' && req.user.userId !== id) throw new UnauthorizedException();
        if (req.user.role === 'agent' && user.agentId !== req.user.userId) throw new UnauthorizedException();

        return userResp;
    }
}
