import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { parseDurationToSeconds } from '../../common/util/duration.util';

const JwtRegistration = JwtModule.registerAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    secret: config.get<string>('JWT_ACCESS_SECRET'),
    signOptions: {
      expiresIn: parseDurationToSeconds(config.get<string>('JWT_ACCESS_EXPIRY', '15m')),
    },
  }),
});

@Module({
  imports: [PassportModule, JwtRegistration],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtRegistration],
})
export class AuthModule {}
