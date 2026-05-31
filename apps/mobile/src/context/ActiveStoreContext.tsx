import { createContext, useContext, useState, type ReactNode } from 'react';
import type { StoreDetail } from '@manamap/shared';

interface ActiveStoreContextValue {
  activeStore: StoreDetail | null;
  setActiveStore: (store: StoreDetail | null) => void;
}

const ActiveStoreContext = createContext<ActiveStoreContextValue | null>(null);

export function ActiveStoreProvider({ children }: { children: ReactNode }) {
  const [activeStore, setActiveStore] = useState<StoreDetail | null>(null);
  return (
    <ActiveStoreContext.Provider value={{ activeStore, setActiveStore }}>
      {children}
    </ActiveStoreContext.Provider>
  );
}

export function useActiveStore() {
  const ctx = useContext(ActiveStoreContext);
  if (!ctx) throw new Error('useActiveStore must be used inside ActiveStoreProvider');
  return ctx;
}
