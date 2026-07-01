import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type { PinoLogger } from 'nestjs-pino';
import { InjectPinoLogger } from 'nestjs-pino';
import type { Env } from '../config/config.schema';

interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
}

interface GoogleUserInfo {
  sub: string;
  email: string | undefined;
  name: string | undefined;
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

  async exchangeCode(
    code: string,
    codeVerifier?: string,
    redirectUri?: string,
  ): Promise<GoogleProfile> {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException('Google OAuth is not configured on this server');
    }

    try {
      const params: Record<string, string> = {
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri ?? '',
      };
      if (codeVerifier) params['code_verifier'] = codeVerifier;

      const tokenRes = await axios.post<GoogleTokenResponse>(
        'https://oauth2.googleapis.com/token',
        new URLSearchParams(params),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );

      const userinfoRes = await axios.get<GoogleUserInfo>(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        { headers: { Authorization: `Bearer ${tokenRes.data.access_token}` } },
      );

      return {
        sub: userinfoRes.data.sub,
        email: userinfoRes.data.email,
        name: userinfoRes.data.name,
      };
    } catch (err) {
      const axiosData = (err as { response?: { data?: unknown } }).response?.data;
      this.logger.warn(
        { err: err instanceof Error ? err : new Error(String(err)), googleError: axiosData },
        'Google OAuth failed',
      );
      throw new UnauthorizedException('Google OAuth failed — invalid or expired code');
    }
  }
}
