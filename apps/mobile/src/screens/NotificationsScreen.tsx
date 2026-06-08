import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, TabActions } from '@react-navigation/native';
import { useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useNotifications, useMarkNotificationsRead } from '../hooks/useNotifications';
import { navigationRef } from '../lib/navigationRef';
import { colors, radii, spacing, typography } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function kindIcon(kind: string): IoniconName {
  switch (kind) {
    case 'CONNECT_REQUEST': return 'person-add-outline';
    case 'CONNECT_ACCEPTED': return 'checkmark-circle-outline';
    case 'POD': return 'people-outline';
    case 'GAME_CONFIRM': return 'game-controller-outline';
    case 'EVENT_REMINDER': return 'calendar-outline';
    case 'BROADCAST': return 'megaphone-outline';
    case 'NEARBY': return 'radio-outline';
    case 'QUEST': return 'trophy-outline';
    case 'PLAY_INVITE': return 'videocam-outline';
    default: return 'notifications-outline';
  }
}

function deepLinkByKind(
  kind: string,
  data: Record<string, unknown> | null,
) {
  if (!navigationRef.isReady()) return;
  switch (kind) {
    case 'CONNECT_REQUEST':
    case 'GAME_CONFIRM':
      navigationRef.navigate('Main');
      navigationRef.dispatch(TabActions.jumpTo('Connections'));
      break;
    case 'CONNECT_ACCEPTED':
      if (data?.connectionId) {
        navigationRef.navigate('Connected', { connectionId: data.connectionId as string });
      } else {
        navigationRef.navigate('Main');
      }
      break;
    case 'POD':
      if (data?.podId) {
        navigationRef.navigate('Pod', { podId: data.podId as string });
      } else {
        navigationRef.navigate('Main');
      }
      break;
    case 'PLAY_INVITE':
      if (data?.roomLink) {
        void Linking.openURL(data.roomLink as string);
      }
      break;
    case 'NEARBY':
    case 'BROADCAST':
    case 'EVENT_REMINDER':
    case 'QUEST':
    default:
      navigationRef.navigate('Main');
      break;
  }
}

interface NotifRowProps {
  id: string;
  kind: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
  onPress: (id: string) => void;
}

function NotifRow({ id, kind, title, body, readAt, createdAt, data: _data, onPress }: NotifRowProps) {
  const unread = readAt === null;
  return (
    <Pressable
      style={({ pressed }) => [styles.row, unread && styles.rowUnread, pressed && { opacity: 0.75 }]}
      onPress={() => onPress(id)}
    >
      <View style={[styles.iconTile, unread && styles.iconTileUnread]}>
        <Ionicons name={kindIcon(kind)} size={20} color={unread ? colors.accent : colors.textSecondary} />
      </View>
      <View style={styles.rowContent}>
        <Text style={[styles.rowTitle, unread && styles.rowTitleUnread]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.rowBody} numberOfLines={2}>{body}</Text>
        <Text style={styles.rowTime}>{relativeTime(createdAt)}</Text>
      </View>
      {unread && <View style={styles.unreadDot} />}
    </Pressable>
  );
}

export function NotificationsScreen({ navigation }: Props) {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useNotifications();
  const markRead = useMarkNotificationsRead();

  const allItems = data?.pages.flatMap((p) => p.items) ?? [];
  const newItems = allItems.filter((n) => n.readAt === null);
  const earlierItems = allItems.filter((n) => n.readAt !== null);

  useFocusEffect(
    useCallback(() => {
      // no-op; screen focuses on open
    }, []),
  );

  function handlePress(id: string) {
    const item = allItems.find((n) => n.id === id);
    if (!item) return;
    markRead.mutate([id]);
    navigation.goBack();
    deepLinkByKind(item.kind, item.data);
  }

  function handleMarkAll() {
    markRead.mutate(undefined);
  }

  type ListItem =
    | { type: 'header'; label: string }
    | { type: 'notif'; item: (typeof allItems)[number] }
    | { type: 'empty'; label: string };

  const listData: ListItem[] = [];
  if (newItems.length > 0) {
    listData.push({ type: 'header', label: 'New' });
    newItems.forEach((item) => listData.push({ type: 'notif', item }));
  }
  if (earlierItems.length > 0) {
    listData.push({ type: 'header', label: 'Earlier' });
    earlierItems.forEach((item) => listData.push({ type: 'notif', item }));
  }
  if (!isLoading && allItems.length === 0) {
    listData.push({ type: 'empty', label: 'No notifications yet' });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.screenTitle}>Notifications</Text>
        {newItems.length > 0 ? (
          <Pressable onPress={handleMarkAll} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </Pressable>
        ) : (
          <View style={styles.markAllBtn} />
        )}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item, i) =>
            item.type === 'notif' ? item.item.id : `${item.type}-${i}`
          }
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return <Text style={styles.sectionHeader}>{item.label}</Text>;
            }
            if (item.type === 'empty') {
              return (
                <View style={styles.emptyWrap}>
                  <Ionicons name="notifications-off-outline" size={40} color={colors.textTertiary} />
                  <Text style={styles.emptyText}>{item.label}</Text>
                </View>
              );
            }
            const n = item.item;
            return (
              <NotifRow
                key={n.id}
                id={n.id}
                kind={n.kind}
                title={n.title}
                body={n.body}
                data={n.data}
                readAt={n.readAt}
                createdAt={n.createdAt}
                onPress={handlePress}
              />
            );
          }}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            isFetchingNextPage ? <ActivityIndicator color={colors.accent} style={styles.footer} /> : null
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  backBtn: {
    width: 32,
  },
  screenTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
    color: colors.textPrimary,
  },
  markAllBtn: {
    width: 80,
    alignItems: 'flex-end',
  },
  markAllText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.accent,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  sectionHeader: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
    gap: spacing.sm,
  },
  rowUnread: {
    backgroundColor: colors.accentLight,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconTileUnread: {
    backgroundColor: colors.accentLight,
  },
  rowContent: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  rowTitleUnread: {
    fontFamily: typography.fontFamily.bold,
    color: colors.textPrimary,
  },
  rowBody: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  rowTime: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    marginTop: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: radii.full,
    backgroundColor: colors.accent,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  emptyText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
  },
  footer: {
    paddingVertical: spacing.md,
  },
});
