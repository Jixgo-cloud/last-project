import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Public search remains available; only verified, active identities receive personalization. */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = any>(err: unknown, user: TUser): TUser {
    return err || !user ? null as TUser : user;
  }
}
