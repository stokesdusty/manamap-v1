import { Pressable, StyleSheet, Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { DiscoverScreen } from '../screens/DiscoverScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { ConnectScreen } from '../screens/ConnectScreen';
import { ScanScreen } from '../screens/ScanScreen';
import { YouScreen } from '../screens/YouScreen';
import { useNotificationUnreadCount } from '../hooks/useNotifications';
import { useAuth } from '../context/AuthContext';
import { useIdentityTheme } from '../hooks/useIdentityTheme';
import { colors, radii, shadows, typography } from '../theme';
import type { TabParamList, RootStackParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

export function BellButton() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isAuthenticated } = useAuth();
  const { data: count } = useNotificationUnreadCount(isAuthenticated);
  const badge = count !== undefined && count > 0;

  return (
    <Pressable
      onPress={() => navigation.navigate('Notifications')}
      style={bellStyles.btn}
      hitSlop={8}
    >
      <View style={bellStyles.iconWrap}>
        <Ionicons name="notifications-outline" size={22} color={colors.textSecondary} />
        {badge && (
          <View style={bellStyles.badge}>
            <Text style={bellStyles.badgeText}>{count > 99 ? '99+' : count}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const bellStyles = StyleSheet.create({
  btn: {
    padding: 4,
  },
  iconWrap: {
    width: 22,
    height: 22,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -7,
    minWidth: 16,
    height: 16,
    borderRadius: radii.full,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 9,
    color: colors.textInverse,
    lineHeight: 12,
  },
});

function ScanButton({ onPress }: BottomTabBarButtonProps) {
  const { accent } = useIdentityTheme();
  return (
    <Pressable onPress={onPress ?? undefined} style={styles.scanWrap}>
      <View style={[styles.scanPip, { backgroundColor: accent }]}>
        <Ionicons name="scan-outline" size={24} color={colors.textInverse} />
      </View>
    </Pressable>
  );
}

export function TabNavigator() {
  const { accent } = useIdentityTheme();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
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
        name="Discover"
        component={DiscoverScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="radio-outline" size={size} color={color} />
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
    paddingBottom: 8,
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
});
