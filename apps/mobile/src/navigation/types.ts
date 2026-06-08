import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { PublicProfile, SharedEventSummary } from '@manamap/shared';

export type RootStackParamList = {
  SignIn: undefined;
  Onboarding: undefined;
  Main: undefined;
  History: undefined;
  Notifications: undefined;
  StoresMap: { storeId?: string } | undefined;
  PlayerPreview: {
    profile: PublicProfile;
    sharedEvent?: SharedEventSummary | null;
    lastMetStoreName?: string | null;
  };
  Connected: { connectionId: string; isNew?: boolean };
  Pod: { podId: string };
  LifeTracker: { podId: string };
  Dev: undefined;
};

export type TabParamList = {
  Discover: undefined;
  Home: undefined;
  Connections: undefined;
  Scan: undefined;
  You: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type TabScreenProps<T extends keyof TabParamList> =
  BottomTabScreenProps<TabParamList, T>;

// Composite type for screens inside a tab that also need to push root-stack screens
export type ScanScreenProps = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Scan'>,
  NativeStackScreenProps<RootStackParamList>
>;
