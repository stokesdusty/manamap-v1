import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type { PinoLogger } from 'nestjs-pino';
import { InjectPinoLogger } from 'nestjs-pino';
import type { Env } from '../config/config.schema';

interface GoogleTokenInfo {
  sub: string;
  email?: string;
  name?: string;
  aud: string;
  email_verified?: string;
}

export interface GoogleProfile {
  sub: string;
  email: string | undefined;
  name: string | undefined;
}

@Injectable()
export class GoogleService {
  constructor(
    @InjectPinoLogger(GoogleService.name) private readonly logger: PinoLogger,
    private readonly config: ConfigService<Env>,
  ) {}

  async verifyIdToken(idToken: string): Promise<GoogleProfile> {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId) {
      throw new ServiceUnavailableException('Google OAuth is not configured on this server');
    }

    try {
      const { data } = await axios.get<GoogleTokenInfo>(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
      );

      if (data.aud !== clientId) {
        throw new UnauthorizedException('Google token audience mismatch');
      }

      return { sub: data.sub, email: data.email, name: data.name };
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      const axiosData = (err as { response?: { data?: unknown } }).response?.data;
      this.logger.warn(
        { err: err instanceof Error ? err : new Error(String(err)), googleError: axiosData },
        'Google ID token verification failed',
      );
      throw new UnauthorizedException('Google sign in failed — invalid token');
    }
  }
}
