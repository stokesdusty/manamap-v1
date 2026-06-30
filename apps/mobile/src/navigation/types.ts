import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { PublicProfile, SharedEventSummary } from '@manamap/shared';

export type PodFormPlayer = {
  id: string;
  displayName: string;
  avatarColors: string[];
  isGuest: boolean;
};

export type RootStackParamList = {
  SignIn: undefined;
  Onboarding: undefined;
  Main: undefined;
  History: undefined;
  Notifications: { openBroadcast?: { title: string; body: string; storeName: string } } | undefined;
  StoresMap: { storeId?: string } | undefined;
  Discover: undefined;
  PlayerPreview: {
    profile: PublicProfile;
    sharedEvent?: SharedEventSummary | null;
    lastMetStoreName?: string | null;
  };
  Connected: { connectionId: string; isNew?: boolean };
  Pod: { podId: string };
  LifeTracker: { podId?: string; initialPlayers?: PodFormPlayer[] };
  Dev: undefined;
};

export type TabParamList = {
  Home: undefined;
  Stores: { storeId?: string } | undefined;
  Scan: undefined;
  Connections: undefined;
  You: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

export type TabScreenProps<T extends keyof TabParamList> = BottomTabScreenProps<TabParamList, T>;

// Composite type for screens inside a tab that also need to push root-stack screens
export type ScanScreenProps = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Scan'>,
  NativeStackScreenProps<RootStackParamList>
>;
