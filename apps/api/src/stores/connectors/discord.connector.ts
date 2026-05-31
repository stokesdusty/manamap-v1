import type { ConnectorEvent, IEventConnector } from './event-connector.interface';

// TODO: Fetch scheduled events from the store's Discord guild via the Discord API.
// Requires store.discordGuildId (separate field, not yet on schema) and a bot token.
export class DiscordConnector implements IEventConnector {
  readonly source = 'DISCORD' as const;

  async fetchEvents(_storeId: string): Promise<ConnectorEvent[]> {
    return [];
  }
}
