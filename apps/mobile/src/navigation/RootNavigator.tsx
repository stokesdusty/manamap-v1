import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { ConnectedRevealScreen } from '../screens/ConnectedRevealScreen';
import { DiscoverScreen } from '../screens/DiscoverScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { PlayerPreviewScreen } from '../screens/PlayerPreviewScreen';
import { PodScreen } from '../screens/PodScreen';
import { LifeTrackerScreen } from '../screens/LifeTrackerScreen';
import { SignInScreen } from '../screens/SignInScreen';
import { StoresScreen } from '../screens/StoresScreen';
import { TabNavigator } from './TabNavigator';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useProfile } from '../hooks/useMe';
import { DevScreen } from '../screens/DevScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile({ enabled: isAuthenticated });
  usePushNotifications(isAuthenticated);

  if (isLoading || (isAuthenticated && profileLoading && !profile)) return null;

  const needsOnboarding = isAuthenticated && (profile == null || profile.onboardedAt == null);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        needsOnboarding ? (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : (
          <>
            <Stack.Screen name="Main" component={TabNavigator} />
            <Stack.Screen name="History" component={HistoryScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="StoresMap" component={StoresScreen} options={{ presentation: 'modal' }} />
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <Stack.Screen name="Discover" component={DiscoverScreen as any} options={{ presentation: 'modal' }} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="PlayerPreview" component={PlayerPreviewScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="Connected" component={ConnectedRevealScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="Pod" component={PodScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="LifeTracker" component={LifeTrackerScreen} options={{ presentation: 'fullScreenModal', headerShown: false }} />
            {__DEV__ ? (
              <Stack.Screen
                name="Dev"
                component={DevScreen}
                options={{ presentation: 'modal' }}
              />
            ) : null}
          </>
        )
      ) : (
        <Stack.Screen name="SignIn" component={SignInScreen} />
      )}
    </Stack.Navigator>
  );
}
