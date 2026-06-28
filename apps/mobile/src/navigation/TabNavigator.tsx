import { Pressable, StyleSheet, Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { HomeScreen } from '../screens/HomeScreen';
import { StoresScreen } from '../screens/StoresScreen';
import { ConnectScreen } from '../screens/ConnectScreen';
import { ScanScreen } from '../screens/ScanScreen';
import { YouScreen } from '../screens/YouScreen';
import { useIdentityTheme } from '../hooks/useIdentityTheme';
import { colors, radii, shadows, typography } from '../theme';
import type { TabParamList } from './types';

export { BellButton } from '../components/BellButton';

const Tab = createBottomTabNavigator<TabParamList>();

function ScanButton({ onPress }: BottomTabBarButtonProps) {
  const { accent } = useIdentityTheme();
  return (
    <Pressable onPress={onPress ?? undefined} style={styles.scanWrap}>
      <View style={[styles.scanPip, { backgroundColor: accent }]}>
        <Ionicons name="scan-outline" size={24} color={colors.textInverse} />
      </View>
      <Text style={styles.scanLabel}>Scan QR</Text>
    </Pressable>
  );
}

const TAB_BAR_BASE_HEIGHT = 56;

export function TabNavigator() {
  const { accent } = useIdentityTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: [
          styles.tabBar,
          { height: TAB_BAR_BASE_HEIGHT + insets.bottom, paddingBottom: insets.bottom },
        ],
        tabBarActiveTintColor: accent,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: {
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.fontSize.xs,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Stores"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        component={StoresScreen as any}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="map-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Scan"
        component={ScanScreen}
        options={{
          tabBarButton: (props) => <ScanButton {...props} />,
          tabBarLabel: () => null,
        }}
      />
      <Tab.Screen
        name="Connections"
        component={ConnectScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="You"
        component={YouScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.borderLight,
    borderTopWidth: 1,
  },
  scanWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 6,
  },
  scanPip: {
    width: 52,
    height: 52,
    borderRadius: radii.full,
    // backgroundColor set dynamically via useIdentityTheme in ScanButton
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  scanLabel: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    marginTop: 4,
  },
});
