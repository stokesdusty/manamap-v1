import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useNotificationUnreadCount } from '../hooks/useNotifications';
import { useAuth } from '../context/AuthContext';
import { colors, radii, typography } from '../theme';
import type { RootStackParamList } from '../navigation/types';

export function BellButton() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isAuthenticated } = useAuth();
  const { data: count } = useNotificationUnreadCount(isAuthenticated);
  const badge = count !== undefined && count > 0;

  return (
    <Pressable
      onPress={() => navigation.navigate('Notifications')}
      style={styles.btn}
      hitSlop={8}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="notifications" size={28} color={colors.textSecondary} />
        {badge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    padding: 4,
  },
  iconWrap: {
    width: 28,
    height: 28,
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
