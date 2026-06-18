import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'manamap',
  slug: 'manamap',
  version: '1.0.0',
  runtimeVersion: '1.0.0',
  updates: { url: 'https://u.expo.dev/3497a3d5-7a81-4da9-89a3-5108ce4a69ee' },
  orientation: 'default',
  scheme: 'manamap',
  userInterfaceStyle: 'light',
  ios: {
    bundleIdentifier: 'com.manamap.app',
    supportsTablet: false,
    usesAppleSignIn: true,
    // react-native-maps uses Apple Maps on iOS by default — no API key required
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        '$(PRODUCT_NAME) uses your location to confirm you\'re at the store before checking in.',
      ITSAppUsesNonExemptEncryption: false
    },
  },
  android: {
    package: 'com.manamap.app',
    adaptiveIcon: { backgroundColor: '#F7F3EE' },
    // Set MAPS_API_KEY env var at build time for Google Maps on Android
    config: {
      googleMaps: { apiKey: process.env['MAPS_API_KEY'] ?? '' },
    },
  },
  plugins: [
    'expo-dev-client',
    'expo-font',
    'expo-splash-screen',
    'expo-secure-store',
    'expo-apple-authentication',
    ['expo-build-properties', { ios: { newArchEnabled: false }, android: { newArchEnabled: false } }],
    [
      'expo-camera',
      { cameraPermission: '$(PRODUCT_NAME) needs camera access to scan player QR codes.' },
    ],
    [
      'expo-notifications',
      { androidMode: 'default' },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          '$(PRODUCT_NAME) uses your location to confirm you\'re at the store before checking in.',
      },
    ],
  ],
  extra: {
    eas: { projectId: '3497a3d5-7a81-4da9-89a3-5108ce4a69ee' },
  },
};

export default config;
