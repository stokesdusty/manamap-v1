import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PostHog } from 'posthog-node';
import type { Env } from '../config/config.schema';

@Injectable()
export class AnalyticsService implements OnModuleDestroy {
  private readonly client: PostHog | null;

  constructor(config: ConfigService<Env>) {
    const apiKey = config.get<string>('POSTHOG_API_KEY');
    this.client = apiKey
      ? new PostHog(apiKey, {
          host: config.get<string>('POSTHOG_HOST') ?? 'https://us.i.posthog.com',
        })
      : null;
  }

  capture(distinctId: string, event: string, properties?: Record<string, unknown>): void {
    this.client?.capture({
      distinctId,
      event,
      ...(properties !== undefined ? { properties } : {}),
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.shutdown();
  }
}
