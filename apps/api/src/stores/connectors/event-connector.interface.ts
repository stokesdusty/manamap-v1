import type { EventSource } from '@prisma/client';

export type ConnectorEvent = {
  externalId: string;
  name: string;
  startsAt: Date;
  endsAt: Date | null;
  description: string | null;
  url: string | null;
  eventChannelUrl: string | null;
  formatSlug: string | null;
};

export interface IEventConnector {
  readonly source: EventSource;
  fetchEvents(storeId: string): Promise<ConnectorEvent[]>;
}
