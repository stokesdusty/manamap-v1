import { useEffect, useMemo } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { PostHog, PostHogProvider, useNavigationTracker } from 'posthog-react-native';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { queryClient } from './src/lib/queryClient';
import { navigationRef } from './src/lib/navigationRef';
import { AuthProvider } from './src/context/AuthContext';
import { ActiveStoreProvider } from './src/context/ActiveStoreContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { colors } from './src/theme';

SplashScreen.preventAutoHideAsync();

const navTheme = {
  dark: false,
  colors: {
    primary: colors.accent,
    background: colors.paper,
    card: colors.surface,
    text: colors.textPrimary,
    border: colors.borderLight,
    notification: colors.accent,
  },
};

// Screen views need to fire from inside NavigationContainer (useNavigationTracker relies on
// React Navigation's own hooks), while PostHogProvider must wrap AuthProvider so identify()/
// reset() are reachable there — so screen tracking is wired separately, not via the provider's
// built-in captureScreens option.
function PostHogScreenTracker() {
  useNavigationTracker();
  return null;
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  const posthogClient = useMemo(() => {
    const apiKey = process.env['EXPO_PUBLIC_POSTHOG_API_KEY'] ?? '';
    const client = new PostHog(apiKey, {
      host: process.env['EXPO_PUBLIC_POSTHOG_HOST'] ?? 'https://us.i.posthog.com',
    });
    if (!apiKey) {
      void client.optOut();
    }
    return client;
  }, []);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.paper }}>
      <KeyboardProvider>
        <SafeAreaProvider>
          <PostHogProvider client={posthogClient} autocapture={{ captureScreens: false }}>
            <QueryClientProvider client={queryClient}>
              <AuthProvider>
                <ActiveStoreProvider>
                  <NavigationContainer ref={navigationRef} theme={navTheme}>
                    <PostHogScreenTracker />
                    <RootNavigator />
                  </NavigationContainer>
                </ActiveStoreProvider>
              </AuthProvider>
            </QueryClientProvider>
          </PostHogProvider>
          <StatusBar style="dark" />
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
