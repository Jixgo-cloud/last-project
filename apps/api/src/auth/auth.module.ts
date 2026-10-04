import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { AuthSecurityService, requireJwtSecret } from './auth-security.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: requireJwtSecret(config.get<string>('JWT_SECRET')),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN')?.trim() || '7d' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthSecurityService, JwtStrategy, JwtAuthGuard, RolesGuard],
  exports: [AuthService, AuthSecurityService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
