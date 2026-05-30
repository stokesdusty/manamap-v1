import { Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { Env } from '../config/config.schema';

// Cached JWKS fetcher — re-fetches only when a new kid is encountered or after 5 min cooldown
const appleJwks = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'), {
  cooldownDuration: 300_000,
});

export interface ApplePayload {
  sub: string;
  email: string | undefined;
}

@Injectable()
export class AppleService {
  private readonly logger = new Logger(AppleService.name);

  constructor(private readonly config: ConfigService<Env>) {}

  async verify(identityToken: string): Promise<ApplePayload> {
    const clientId = this.config.get<string>('APPLE_CLIENT_ID');
    if (!clientId) {
      throw new ServiceUnavailableException('Apple Sign In is not configured on this server');
    }

    try {
      const { payload } = await jwtVerify(identityToken, appleJwks, {
        issuer: 'https://appleid.apple.com',
        audience: clientId,
      });

      const sub = payload.sub;
      if (!sub) throw new Error('Missing sub claim');

      return {
        sub,
        email: typeof payload['email'] === 'string' ? payload['email'] : undefined,
      };
    } catch (err) {
      this.logger.warn('Apple token verification failed', err instanceof Error ? err.message : err);
      throw new UnauthorizedException('Invalid Apple identity token');
    }
  }
}
