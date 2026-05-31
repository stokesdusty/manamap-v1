import type { ConnectorEvent, IEventConnector } from './event-connector.interface';

// Manual/store-entered events are authored directly in the DB via the API.
// This connector is a no-op; the StoresService reads STORE-source events directly.
export class StoreConnector implements IEventConnector {
  readonly source = 'STORE' as const;

  async fetchEvents(_storeId: string): Promise<ConnectorEvent[]> {
    return [];
  }
}
