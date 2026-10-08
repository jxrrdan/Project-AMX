import { Body, Controller, Ip, Post, Headers } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { LoginDto, RefreshDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** 10 attempts/minute/IP — slows credential stuffing; MFA codes share this budget. */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Public()
  @Post('login')
  login(@Body() dto: LoginDto, @Ip() ip: string, @Headers('user-agent') userAgent: string) {
    return this.authService.login(dto, ip, userAgent);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  logout(@Body() dto: RefreshDto) {
    return this.authService.logout(dto.refreshToken);
  }
}
