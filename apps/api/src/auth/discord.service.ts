import { Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type { Env } from '../config/config.schema';

interface DiscordTokenResponse {
  access_token: string;
  token_type: string;
}

export interface DiscordProfile {
  id: string;
  username: string;
  global_name: string | null;
  email: string | null;
  avatar: string | null;
}

@Injectable()
export class DiscordService {
  private readonly logger = new Logger(DiscordService.name);

  constructor(private readonly config: ConfigService<Env>) {}

  async exchangeCode(code: string, codeVerifier?: string): Promise<DiscordProfile> {
    const clientId = this.config.get<string>('DISCORD_CLIENT_ID');
    const clientSecret = this.config.get<string>('DISCORD_CLIENT_SECRET');
    const redirectUri = this.config.get<string>('DISCORD_REDIRECT_URI');

    if (!clientId || !clientSecret || !redirectUri) {
      throw new ServiceUnavailableException('Discord OAuth is not configured on this server');
    }

    try {
      const params: Record<string, string> = {
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      };
      if (codeVerifier) params['code_verifier'] = codeVerifier;

      const tokenRes = await axios.post<DiscordTokenResponse>(
        'https://discord.com/api/oauth2/token',
        new URLSearchParams(params),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );

      const profileRes = await axios.get<DiscordProfile>('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${tokenRes.data.access_token}` },
      });

      return profileRes.data;
    } catch (err) {
      this.logger.warn('Discord OAuth failed', err instanceof Error ? err.message : err);
      throw new UnauthorizedException('Discord OAuth failed — invalid or expired code');
    }
  }
}
