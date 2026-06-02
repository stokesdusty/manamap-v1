import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { ConnectedRevealScreen } from '../screens/ConnectedRevealScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { PlayerPreviewScreen } from '../screens/PlayerPreviewScreen';
import { PodScreen } from '../screens/PodScreen';
import { SignInScreen } from '../screens/SignInScreen';
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
            <Stack.Screen name="PlayerPreview" component={PlayerPreviewScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="Connected" component={ConnectedRevealScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="Pod" component={PodScreen} options={{ presentation: 'modal' }} />
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
