import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  iat: number;
  exp: number;
}

type GuardRequest = {
  headers: { authorization?: string };
  user?: AccessTokenPayload;
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<GuardRequest>();
    const auth = req.headers.authorization;

    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException();
    }

    try {
      const payload = this.jwtService.verify<AccessTokenPayload>(auth.slice(7));
      req.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
