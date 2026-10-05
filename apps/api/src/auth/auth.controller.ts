import { createHash } from 'crypto';
import { Controller, Post, Body, Get, Query, Res, Req, UseGuards, Request, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Public } from './roles.decorator';
import { UserRole } from '@smartcareer/shared';
import { RegisterDto, LoginDto, DevOAuthCallbackDto, OAuthExchangeDto } from './dto/auth.dto';

import { AuthSecurityService, publicRole } from './auth-security.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
    private security: AuthSecurityService,
  ) {}

  @Public()
  @Post('register')
  async register(@Body() body: RegisterDto, @Req() req: any) {
    await this.security.rateLimit('register:ip:' + req.ip, 30, 60 * 60_000);
    return this.authService.register(body);
  }

  @Public()
  @Post('login')
  async login(@Body() body: LoginDto, @Req() req: any) {
    await this.security.rateLimit('login:ip:' + req.ip, 100, 10 * 60_000);
    await this.security.rateLimit('login:email:' + body.email.toLowerCase().trim(), 10, 10 * 60_000);
    return this.authService.login(body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Request() req: any) {
    return this.authService.getMe(req.user.id);
  }

  private getFrontendUrl(origin?: string): string {
    return this.security.frontend(origin);
  }

  private cookieOptions(provider: 'google' | 'github') {
    return {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const, path: '/api/auth/' + provider, maxAge: 10 * 60_000,
    };
  }

  private browserCookie(req: any, provider: 'google' | 'github'): string {
    const entry = (req.headers.cookie || '').split(';').map((v: string) => v.trim())
      .find((v: string) => v.startsWith('smartcareer_oauth_' + provider + '='));
    return entry ? entry.slice(entry.indexOf('=') + 1) : '';
  }

  @Public()
  @Post('oauth/exchange')
  async exchange(@Body() body: OAuthExchangeDto, @Req() req: any) {
    await this.security.rateLimit('exchange:ip:' + req.ip, 100, 10 * 60_000);
    const userId = await this.security.exchange(body.code, body.verifier, req.headers.origin || '');
    return this.authService.getMe(userId);
  }

  private getCallbackUrl(provider: 'google' | 'github'): string {
    const envCallback = this.configService.get<string>(
      provider === 'google' ? 'GOOGLE_CALLBACK_URL' : 'GITHUB_CALLBACK_URL',
    );
    if (process.env.NODE_ENV !== 'production' && envCallback) {
      return envCallback.trim();
    }
    if (envCallback && !envCallback.includes('localhost:4000')) {
      return envCallback.trim();
    }
    if (process.env.RAILWAY_PUBLIC_DOMAIN) {
      return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/api/auth/${provider}/callback`;
    }
    if (process.env.NODE_ENV === 'production') {
      return `https://smartcareerapi-production.up.railway.app/api/auth/${provider}/callback`;
    }
    return envCallback || `http://localhost:4000/api/auth/${provider}/callback`;
  }

  // --- OAuth: Google ---
  @Public()
  @Get('google')
  async googleAuth(
    @Query('role') role: UserRole = UserRole.COMPANY,
    @Query('mode') mode: string = 'login',
    @Query('origin') origin: string,
    @Query('challenge') challenge: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const frontendUrl = this.getFrontendUrl(origin);
    publicRole(role);

    // Strict Rule: CANDIDATE is NOT allowed to sign up or sign in with Google!
    if (role === UserRole.CANDIDATE) {
      return res.redirect(
        `${frontendUrl}/register?error=${encodeURIComponent(
          'Google sign-in and registration are only permitted for Company accounts. Candidates must use GitHub.',
        )}`,
      );
    }

    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const callbackUrl = this.getCallbackUrl('google');

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

    await this.security.rateLimit('oauth:ip:' + req.ip, 100, 10 * 60_000);
    const request = await this.security.start('google', role, frontendUrl, challenge);
    const state = request.state;
    res.cookie('smartcareer_oauth_google', request.browser, this.cookieOptions('google'));
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
    @Req() req: any,
    @Res() res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const state = await this.security.consumeState(stateStr, this.browserCookie(req, 'google'), 'google');
    res.clearCookie('smartcareer_oauth_google', { ...this.cookieOptions('google'), maxAge: undefined });
    const frontendUrl = state.frontendUrl;

    if (error) {
      return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(error)}`);
    }

    try {
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
      const callbackUrl = this.getCallbackUrl('google');

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
      if (profile.email_verified !== true || typeof profile.email !== 'string') {
        throw new BadRequestException('A verified email is required for Google sign-in.');
      }
      const result = await this.authService.handleOAuthUser({
        provider: 'GOOGLE',
        providerId: profile.sub,
        email: profile.email,
        fullName: profile.name,
        avatarUrl: profile.picture,
        requestedRole: state.role,
      });

      const exchangeCode = await this.security.grant(result.id, frontendUrl, state.challenge);
      return res.redirect(frontendUrl + '/callback?code=' + exchangeCode);
    } catch (err: any) {
      const msg = 'Unable to sign in. Please start again with GitHub for candidates or Google for companies.';
      return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(msg)}`);
    }
  }

  // --- OAuth: GitHub ---
  @Public()
  @Get('github')
  async githubAuth(
    @Query('role') role: UserRole = UserRole.CANDIDATE,
    @Query('mode') mode: string = 'login',
    @Query('origin') origin: string,
    @Query('challenge') challenge: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const frontendUrl = this.getFrontendUrl(origin);
    publicRole(role);

    // Strict Rule: COMPANY is NOT allowed to sign up or sign in with GitHub!
    if (role === UserRole.COMPANY) {
      return res.redirect(
        `${frontendUrl}/register?error=${encodeURIComponent(
          'GitHub sign-in and registration are only permitted for Candidate accounts. Companies must use Google.',
        )}`,
      );
    }

    const clientId = this.configService.get<string>('GITHUB_CLIENT_ID');
    const callbackUrl = this.getCallbackUrl('github');

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

    await this.security.rateLimit('oauth:ip:' + req.ip, 100, 10 * 60_000);
    const request = await this.security.start('github', role, frontendUrl, challenge);
    const state = request.state;
    res.cookie('smartcareer_oauth_github', request.browser, this.cookieOptions('github'));
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
    @Req() req: any,
    @Res() res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const state = await this.security.consumeState(stateStr, this.browserCookie(req, 'github'), 'github');
    res.clearCookie('smartcareer_oauth_github', { ...this.cookieOptions('github'), maxAge: undefined });
    const frontendUrl = state.frontendUrl;

    if (error) {
      return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(error)}`);
    }

    try {
      // Security Guard: Reject Company on GitHub callback
      if (state.role === UserRole.COMPANY) {
        return res.redirect(
          `${frontendUrl}/register?error=${encodeURIComponent(
            'Company accounts cannot sign up with GitHub. Please use Google.',
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

      // Link accounts only by a provider-verified email, including private GitHub emails.
      const emailsRes = await axios.get('https://api.github.com/user/emails', {
        headers: { Authorization: 'Bearer ' + accessToken, 'User-Agent': 'SmartCareer-App' },
      });
      const verifiedEmail = emailsRes.data.find((e: any) => e.primary && e.verified)
        || emailsRes.data.find((e: any) => e.verified);
      if (!verifiedEmail?.email) throw new BadRequestException('A verified GitHub email is required.');
      const userEmail = verifiedEmail.email;

      const result = await this.authService.handleOAuthUser({
        provider: 'GITHUB',
        providerId: String(ghUser.id),
        email: userEmail,
        fullName: ghUser.name || ghUser.login,
        avatarUrl: ghUser.avatar_url,
        githubUsername: ghUser.login,
        requestedRole: state.role,
      });

      const exchangeCode = await this.security.grant(result.id, frontendUrl, state.challenge);
      return res.redirect(frontendUrl + '/callback?code=' + exchangeCode);
    } catch (err: any) {
      const msg = 'Unable to sign in. Please start again with GitHub for candidates or Google for companies.';
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
        'GitHub sign-in and registration are strictly prohibited for Company accounts. Companies must use Google.',
      );
    }

    if (providerUpper === 'GOOGLE' && body.role === UserRole.CANDIDATE) {
      throw new BadRequestException(
        'Google sign-in and registration are strictly prohibited for Candidate accounts. Candidates must use GitHub.',
      );
    }

    const providerId = `dev_${body.provider}_${createHash('sha256').update(body.email.toLowerCase().trim()).digest('hex')}`;
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
