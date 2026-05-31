import type { ConnectorEvent, IEventConnector } from './event-connector.interface';

// TODO: Fetch events from the Wizards Event Locator API using the store's WPN retailer ID.
// Endpoint: https://locator.wizards.com/api/... (requires retailer mapping table)
export class WizardsConnector implements IEventConnector {
  readonly source = 'WIZARDS' as const;

  async fetchEvents(_storeId: string): Promise<ConnectorEvent[]> {
    return [];
  }
}
