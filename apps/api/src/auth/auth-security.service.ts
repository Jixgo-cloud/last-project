import { BadRequestException, HttpException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@smartcareer/shared';

export function requireJwtSecret(value?: string): string {
  if (!value || value.length < 32 || value.includes('change_in_prod')) {
    throw new Error('JWT_SECRET must be configured with a unique secret of at least 32 characters.');
  }
  return value;
}

export function allowedFrontendOrigins(config: Pick<ConfigService, 'get'>): string[] {
  const values = [
    config.get<string>('FRONTEND_URL') || 'https://smartcareerplatform.vercel.app',
    ...(config.get<string>('ALLOWED_ORIGINS') || '').split(','),
    ...(config.get<string>('NODE_ENV') === 'development' ? ['http://localhost:3000', 'http://127.0.0.1:3000'] : []),
  ];
  return [...new Set(values.filter(v => v.trim()).map(v => {
    const url = new URL(v.trim());
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
        (url.protocol !== 'https:' && !(config.get<string>('NODE_ENV') === 'development' && url.protocol === 'http:'))) {
      throw new Error('Frontend origins must be exact HTTPS origins (HTTP is permitted only in development).');
    }
    return url.origin === 'https://smartcareer.vercel.app' ? 'https://smartcareerplatform.vercel.app' : url.origin;
  }))];
}

export function publicRole(role: unknown): UserRole {
  if (role !== UserRole.CANDIDATE && role !== UserRole.COMPANY) {
    throw new BadRequestException('Only Candidate and Company accounts can be registered.');
  }
  return role;
}

type StatePayload = {
  provider: 'google' | 'github'; role: UserRole; frontendUrl: string;
  browserHash: string; challenge: string;
};

@Injectable()
export class AuthSecurityService {
  constructor(private prisma: PrismaService, private config: ConfigService) {}

  frontend(origin?: string): string {
    const allowed = allowedFrontendOrigins(this.config);
    if (!origin) return allowed[0];
    let url: URL;
    try { url = new URL(origin); } catch { throw new BadRequestException('Invalid frontend origin'); }
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash || !allowed.includes(url.origin)) {
      throw new BadRequestException('Frontend origin is not allowed');
    }
    return url.origin;
  }

  private hash(value: string): string { return createHash('sha256').update(value).digest('hex'); }
  private equal(a: string, b: string): boolean {
    const left = Buffer.from(a); const right = Buffer.from(b);
    return left.length === right.length && timingSafeEqual(left, right);
  }

  async start(provider: 'google' | 'github', role: UserRole, origin: string | undefined, challenge: string) {
    publicRole(role);
    if ((provider === 'google' && role !== UserRole.COMPANY) || (provider === 'github' && role !== UserRole.CANDIDATE)) {
      throw new BadRequestException('Google is for Company accounts; GitHub is for Candidate accounts.');
    }
    if (!/^[A-Za-z0-9_-]{43}$/.test(challenge || '')) throw new BadRequestException('OAuth browser verification is required');
    const frontendUrl = this.frontend(origin);
    const state = randomBytes(32).toString('base64url');
    const browser = randomBytes(32).toString('base64url');
    await this.prisma.authChallenge.deleteMany({ where: { expiresAt: { lte: new Date() } } });
    await this.prisma.authChallenge.create({ data: {
      id: this.hash(state), purpose: 'STATE', expiresAt: new Date(Date.now() + 10 * 60_000),
      payload: { provider, role, frontendUrl, browserHash: this.hash(browser), challenge },
    } });
    return { state, browser, frontendUrl };
  }

  async consumeState(state: string, browser: string, provider: 'google' | 'github'): Promise<StatePayload> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(state || '') || !/^[A-Za-z0-9_-]{43}$/.test(browser || '')) {
      throw new UnauthorizedException('Invalid or expired OAuth request; please start again.');
    }
    const id = this.hash(state);
    const row = await this.prisma.authChallenge.findUnique({ where: { id } });
    const payload = row?.payload as StatePayload | undefined;
    if (!row || row.purpose !== 'STATE' || row.expiresAt <= new Date() || payload?.provider !== provider ||
        !this.equal(payload.browserHash, this.hash(browser))) {
      throw new UnauthorizedException('Invalid or expired OAuth request; please start again.');
    }
    this.frontend(payload.frontendUrl);
    publicRole(payload.role);
    const consumed = await this.prisma.authChallenge.deleteMany({ where: { id, purpose: 'STATE', expiresAt: { gt: new Date() } } });
    if (consumed.count !== 1) throw new UnauthorizedException('OAuth request has already been used');
    return payload;
  }

  async grant(userId: string, frontendUrl: string, challenge: string): Promise<string> {
    const code = randomBytes(32).toString('base64url');
    await this.prisma.authChallenge.create({ data: {
      id: this.hash(code), purpose: 'EXCHANGE', expiresAt: new Date(Date.now() + 60_000),
      payload: { userId, frontendUrl, challenge },
    } });
    return code;
  }

  async exchange(code: string, verifier: string, origin: string): Promise<string> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(code || '') || !/^[A-Za-z0-9_-]{43,128}$/.test(verifier || '')) {
      throw new UnauthorizedException('Invalid OAuth exchange');
    }
    const id = this.hash(code);
    const row = await this.prisma.authChallenge.findUnique({ where: { id } });
    const data = row?.payload as { userId: string; frontendUrl: string; challenge: string } | undefined;
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    if (!row || row.purpose !== 'EXCHANGE' || row.expiresAt <= new Date() || !data ||
        origin !== data.frontendUrl || !this.equal(data.challenge, challenge)) {
      throw new UnauthorizedException('Invalid or expired OAuth exchange');
    }
    this.frontend(origin);
    const consumed = await this.prisma.authChallenge.deleteMany({ where: { id, purpose: 'EXCHANGE', expiresAt: { gt: new Date() } } });
    if (consumed.count !== 1) throw new UnauthorizedException('OAuth exchange has already been used');
    return data.userId;
  }

  async rateLimit(key: string, limit: number, windowMs: number) {
    const now = new Date(); const expires = new Date(now.getTime() + windowMs);
    // The SQL is constant; all request values are bound parameters.
    const rows = await this.prisma.$queryRawUnsafe<Array<{ count: number }>>(
      'INSERT INTO auth_rate_limits ("key", "count", "expiresAt") VALUES ($1, 1, $2) ' +
      'ON CONFLICT ("key") DO UPDATE SET ' +
      '"count" = CASE WHEN auth_rate_limits."expiresAt" <= $3 THEN 1 ELSE auth_rate_limits."count" + 1 END, ' +
      '"expiresAt" = CASE WHEN auth_rate_limits."expiresAt" <= $3 THEN $2 ELSE auth_rate_limits."expiresAt" END RETURNING "count"',
      this.hash(key), expires, now,
    );
    if (rows[0].count > limit) throw new HttpException('Too many attempts. Please try again later.', 429);
  }
}
