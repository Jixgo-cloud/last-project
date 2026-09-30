import { Controller, Post, Body, Get, Query, Res, UseGuards, Request, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Public } from './roles.decorator';
import { UserRole } from '@smartcareer/shared';
import { RegisterDto, LoginDto, DevOAuthCallbackDto } from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  @Public()
  @Post('register')
  async register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @Public()
  @Post('login')
  async login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Request() req: any) {
    return this.authService.getMe(req.user.id);
  }

  // --- OAuth: Google ---
  @Public()
  @Get('google')
  async googleAuth(
    @Query('role') role: UserRole = UserRole.COMPANY,
    @Query('mode') mode: string = 'login',
    @Res() res: Response,
  ) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';

    // Strict Rule: CANDIDATE is NOT allowed to sign up or sign in with Google!
    if (role === UserRole.CANDIDATE) {
      return res.redirect(
        `${frontendUrl}/register?error=${encodeURIComponent(
          'Google sign-in and registration are only permitted for Company accounts. Candidates must use GitHub.',
        )}`,
      );
    }

    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const callbackUrl =
      this.configService.get<string>('GOOGLE_CALLBACK_URL') || 'http://localhost:4000/api/auth/google/callback';

    // If client ID is not configured, fallback to Dev / Mock OAuth mode only in development
    if (!clientId) {
      if (process.env.NODE_ENV === 'production') {
        return res.redirect(
          `${frontendUrl}/login?error=${encodeURIComponent(
            'Google authentication is not configured on this server.',
          )}`,
        );
      }
      return res.redirect(`${frontendUrl}/mock-oauth?provider=google&role=${role}&mode=${mode}`);
    }

    const state = Buffer.from(JSON.stringify({ role, mode })).toString('base64');
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      callbackUrl,
    )}&response_type=code&scope=${encodeURIComponent('openid profile email')}&state=${state}&prompt=select_account`;

    return res.redirect(googleAuthUrl);
  }

  @Public()
  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('state') stateStr: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';

    if (error) {
      return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(error)}`);
    }

    try {
      let state = { role: UserRole.COMPANY, mode: 'login' };
      if (stateStr) {
        try {
          state = JSON.parse(Buffer.from(stateStr, 'base64').toString('utf-8'));
        } catch {
          // keep default
        }
      }

      // Security Guard: Reject Candidate on Google callback
      if (state.role === UserRole.CANDIDATE) {
        return res.redirect(
          `${frontendUrl}/register?error=${encodeURIComponent(
            'Google sign-in and registration are only permitted for Company accounts. Candidates must use GitHub.',
          )}`,
        );
      }

      const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
      const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
      const callbackUrl =
        this.configService.get<string>('GOOGLE_CALLBACK_URL') || 'http://localhost:4000/api/auth/google/callback';

      // Exchange code for token
      const tokenRes = await axios.post(
        'https://oauth2.googleapis.com/token',
        {
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: callbackUrl,
          grant_type: 'authorization_code',
        },
        { headers: { 'Content-Type': 'application/json' } },
      );

      const accessToken = tokenRes.data.access_token;
      const userRes = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const profile = userRes.data;
      const result = await this.authService.handleOAuthUser({
        provider: 'GOOGLE',
        providerId: profile.sub,
        email: profile.email,
        fullName: profile.name,
        avatarUrl: profile.picture,
        requestedRole: state.role,
      });

      return res.redirect(`${frontendUrl}/callback?token=${result.token}&role=${result.role}`);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Google authentication failed';
      return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(msg)}`);
    }
  }

  // --- OAuth: GitHub ---
  @Public()
  @Get('github')
  async githubAuth(
    @Query('role') role: UserRole = UserRole.CANDIDATE,
    @Query('mode') mode: string = 'login',
    @Res() res: Response,
  ) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';

    // Strict Rule: COMPANY is NOT allowed to sign up or sign in with GitHub!
    if (role === UserRole.COMPANY) {
      return res.redirect(
        `${frontendUrl}/register?error=${encodeURIComponent(
          'GitHub sign-in and registration are only permitted for Candidate accounts. Companies must use Google or Email.',
        )}`,
      );
    }

    const clientId = this.configService.get<string>('GITHUB_CLIENT_ID');
    const callbackUrl =
      this.configService.get<string>('GITHUB_CALLBACK_URL') || 'http://localhost:4000/api/auth/github/callback';

    // If client ID is not configured, fallback to Dev / Mock OAuth mode only in development
    if (!clientId) {
      if (process.env.NODE_ENV === 'production') {
        return res.redirect(
          `${frontendUrl}/login?error=${encodeURIComponent(
            'GitHub authentication is not configured on this server.',
          )}`,
        );
      }
      return res.redirect(`${frontendUrl}/mock-oauth?provider=github&role=${role}&mode=${mode}`);
    }

    const state = Buffer.from(JSON.stringify({ role, mode })).toString('base64');
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      callbackUrl,
    )}&scope=${encodeURIComponent('read:user user:email')}&state=${state}`;

    return res.redirect(githubAuthUrl);
  }

  @Public()
  @Get('github/callback')
  async githubCallback(
    @Query('code') code: string,
    @Query('state') stateStr: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';

    if (error) {
      return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(error)}`);
    }

    try {
      let state = { role: UserRole.CANDIDATE, mode: 'login' };
      if (stateStr) {
        try {
          state = JSON.parse(Buffer.from(stateStr, 'base64').toString('utf-8'));
        } catch {
          // keep default
        }
      }

      // Security Guard: Reject Company on GitHub callback
      if (state.role === UserRole.COMPANY) {
        return res.redirect(
          `${frontendUrl}/register?error=${encodeURIComponent(
            'Company accounts cannot sign up with GitHub. Please use Google or Email.',
          )}`,
        );
      }

      const clientId = this.configService.get<string>('GITHUB_CLIENT_ID');
      const clientSecret = this.configService.get<string>('GITHUB_CLIENT_SECRET');

      // Exchange code for token
      const tokenRes = await axios.post(
        'https://github.com/login/oauth/access_token',
        {
          client_id: clientId,
          client_secret: clientSecret,
          code,
        },
        {
          headers: {
            Accept: 'application/json',
          },
        },
      );

      const accessToken = tokenRes.data.access_token;
      if (!accessToken) {
        throw new Error('Failed to retrieve GitHub access token');
      }

      // Fetch user profile
      const userRes = await axios.get('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': 'SmartCareer-App',
        },
      });
      const ghUser = userRes.data;

      // Fetch primary email if not public in profile
      let userEmail = ghUser.email;
      if (!userEmail) {
        try {
          const emailsRes = await axios.get('https://api.github.com/user/emails', {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'User-Agent': 'SmartCareer-App',
            },
          });
          const primaryEmailObj = emailsRes.data.find((e: any) => e.primary && e.verified);
          userEmail = primaryEmailObj ? primaryEmailObj.email : emailsRes.data[0]?.email;
        } catch {
          // ignore
        }
      }

      if (!userEmail) {
        userEmail = `${ghUser.login}@users.noreply.github.com`;
      }

      const result = await this.authService.handleOAuthUser({
        provider: 'GITHUB',
        providerId: String(ghUser.id),
        email: userEmail,
        fullName: ghUser.name || ghUser.login,
        avatarUrl: ghUser.avatar_url,
        githubUsername: ghUser.login,
        requestedRole: state.role,
      });

      return res.redirect(`${frontendUrl}/callback?token=${result.token}&role=${result.role}`);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'GitHub authentication failed';
      return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(msg)}`);
    }
  }

  // --- Dev / Mock OAuth Endpoint (Testing without Real Provider Keys) ---
  @Public()
  @Post('dev-callback')
  async devOAuthCallback(@Body() body: DevOAuthCallbackDto) {
    const isDevAllowed =
      process.env.NODE_ENV === 'development' &&
      process.env.ENABLE_DEV_MOCK_AUTH === 'true';

    if (!isDevAllowed) {
      throw new ForbiddenException(
        'Dev / Mock OAuth endpoint is strictly disabled. Real provider OAuth credentials required.',
      );
    }
    const providerUpper = body.provider.toUpperCase() as 'GOOGLE' | 'GITHUB';

    // Strict constraint checks
    if (providerUpper === 'GITHUB' && body.role === UserRole.COMPANY) {
      throw new BadRequestException(
        'GitHub sign-in and registration are strictly prohibited for Company accounts. Companies must use Google or Email.',
      );
    }

    if (providerUpper === 'GOOGLE' && body.role === UserRole.CANDIDATE) {
      throw new BadRequestException(
        'Google sign-in and registration are strictly prohibited for Candidate accounts. Candidates must use GitHub.',
      );
    }

    const providerId = `dev_${body.provider}_${Date.now()}`;
    const result = await this.authService.handleOAuthUser({
      provider: providerUpper,
      providerId,
      email: body.email,
      fullName: body.fullName || (body.provider === 'github' ? body.githubUsername : body.email.split('@')[0]),
      avatarUrl:
        body.avatarUrl ||
        (body.provider === 'github'
          ? `https://github.com/${body.githubUsername || 'octocat'}.png`
          : `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(body.email)}`),
      githubUsername: providerUpper === 'GITHUB' ? body.githubUsername || body.email.split('@')[0] : undefined,
      requestedRole: body.role,
    });

    return result;
  }
}
