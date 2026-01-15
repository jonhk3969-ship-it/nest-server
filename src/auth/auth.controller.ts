import { Controller, Post, Body, UnauthorizedException, Ip, Get, UseGuards, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    // Security: Rate limit user login (5 attempts per minute)
    @Throttle({ default: { limit: 5, ttl: 60000 } })
    @Post('user/login')
    async userLogin(@Body() loginDto: LoginDto, @Ip() ip: string) {
        const user = await this.authService.validateUserClient(loginDto.username, loginDto.password);
        if (!user) {
            throw new UnauthorizedException('ข้อมูลไม่ถูกต้อง');
        }
        return this.authService.login(user, ip);
    }

    // Security: Rate limit agent login (5 attempts per minute)
    @Throttle({ default: { limit: 5, ttl: 60000 } })
    @Post('agent/login')
    async agentLogin(@Body() loginDto: LoginDto) {
        const user = await this.authService.validateAgent(loginDto.username, loginDto.password);
        if (!user) {
            throw new UnauthorizedException('ຂໍ້ມູນບໍ່ຖືກຕ້ອງ');
        }
        return this.authService.login(user); // agent
    }

    // Security: Stricter rate limit for admin login (3 attempts per minute)
    @Throttle({ default: { limit: 3, ttl: 60000 } })
    @Post('admin/login')
    async adminLogin(@Body() loginDto: LoginDto) {
        const user = await this.authService.validateAdmin(loginDto.username, loginDto.password);
        if (!user) {
            throw new UnauthorizedException('ຂໍ້ມູນບໍ່ຖືກຕ້ອງ');
        }
        return this.authService.login(user); // admin
    }

    @UseGuards(JwtAuthGuard)
    @Get('me')
    getMe(@Req() req) {
        return this.authService.getMe(req.user);
    }
}
