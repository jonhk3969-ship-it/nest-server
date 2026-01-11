
import { Controller, Get, Query, Post, Body, UseGuards, Req } from '@nestjs/common';
import { GamesService } from './games.service';
import { LoginGameDto } from './dto/login-game.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('games')
export class GamesController {
    constructor(private readonly gamesService: GamesService) { }

    @Get()
    getGames(@Query('productId') productId: string) {
        return this.gamesService.getGames(productId);
    }

    @UseGuards(JwtAuthGuard)
    @Post('login')
    login(@Body() loginGameDto: LoginGameDto, @Req() req) {
        return this.gamesService.login(req.user.username, loginGameDto.productId, loginGameDto.gameCode, loginGameDto.isMobileLogin, loginGameDto.betLimit);
    }
    @UseGuards(JwtAuthGuard)
    @Get('transactions')
    getTransactions(@Query() query: any) {
        return this.gamesService.getBetTransactions(query);
    }

    @UseGuards(JwtAuthGuard)
    @Get('replay')
    getReplay(@Query() query: any) {
        return this.gamesService.getReplay(query);
    }
}
