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
import { useCallback, useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useNotifications, useMarkNotificationsRead } from '../hooks/useNotifications';
import { navigationRef } from '../lib/navigationRef';
import { BroadcastSheet } from '../components/BroadcastSheet';
import { colors, radii, spacing, typography } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

interface OpenBroadcast {
  title: string;
  body: string;
  storeName: string;
}

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
    case 'CONNECT_REQUEST':
      return 'person-add-outline';
    case 'CONNECT_ACCEPTED':
      return 'checkmark-circle-outline';
    case 'POD':
      return 'people-outline';
    case 'GAME_CONFIRM':
      return 'game-controller-outline';
    case 'EVENT_REMINDER':
      return 'calendar-outline';
    case 'BROADCAST':
      return 'megaphone-outline';
    case 'NEARBY':
      return 'radio-outline';
    case 'QUEST':
      return 'trophy-outline';
    case 'PLAY_INVITE':
      return 'videocam-outline';
    default:
      return 'notifications-outline';
  }
}

function deepLinkByKind(kind: string, data: Record<string, unknown> | null) {
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

function NotifRow({ id, kind, title, body, data, readAt, createdAt, onPress }: NotifRowProps) {
  const unread = readAt === null;
  const storeName = kind === 'BROADCAST' ? (data?.storeName as string | undefined) : undefined;
  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        unread && styles.rowUnread,
        pressed && { opacity: 0.75 },
      ]}
      onPress={() => onPress(id)}
      accessibilityRole="button"
      accessibilityLabel={`${unread ? 'Unread. ' : ''}${title}`}
    >
      <View style={styles.iconTile}>
        <Ionicons name={kindIcon(kind)} size={21} color={colors.accentInk} />
      </View>
      <View style={styles.rowContent}>
        {storeName && (
          <Text style={styles.rowStore} numberOfLines={1}>
            From {storeName}
          </Text>
        )}
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.rowBody} numberOfLines={2}>
          {body}
        </Text>
        <Text style={styles.rowTime}>{relativeTime(createdAt)}</Text>
      </View>
      {unread && <View style={styles.unreadDot} />}
    </Pressable>
  );
}

export function NotificationsScreen({ navigation, route }: Props) {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useNotifications();
  const markRead = useMarkNotificationsRead();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [openBroadcast, setOpenBroadcast] = useState<OpenBroadcast | null>(null);

  const allItems = (data?.pages.flatMap((p) => p.items) ?? []).filter((n) => !dismissed.has(n.id));
  const newItems = allItems.filter((n) => n.readAt === null);
  const earlierItems = allItems.filter((n) => n.readAt !== null);

  useFocusEffect(
    useCallback(() => {
      // no-op; screen focuses on open
    }, []),
  );

  useEffect(() => {
    if (route.params?.openBroadcast) {
      setOpenBroadcast(route.params.openBroadcast);
    }
  }, [route.params?.openBroadcast]);

  function handlePress(id: string) {
    const item = allItems.find((n) => n.id === id);
    if (!item) return;
    markRead.mutate([id]);
    if (item.kind === 'BROADCAST') {
      setOpenBroadcast({
        title: item.title,
        body: item.body,
        storeName: (item.data?.storeName as string | undefined) ?? 'A store',
      });
      return;
    }
    setDismissed((prev) => new Set(prev).add(id));
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
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={8}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={24} color={colors.accent} />
        </Pressable>
        <Text style={styles.screenTitle}>Notifications</Text>
        {newItems.length > 0 ? (
          <Pressable
            onPress={handleMarkAll}
            style={styles.markAllBtn}
            accessibilityRole="button"
          >
            <Text style={styles.markAllText}>Mark read</Text>
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
          keyExtractor={(item, i) => (item.type === 'notif' ? item.item.id : `${item.type}-${i}`)}
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return <Text style={styles.sectionHeader}>{item.label}</Text>;
            }
            if (item.type === 'empty') {
              return (
                <View style={styles.emptyWrap}>
                  <Ionicons name="notifications-outline" size={40} color={colors.textTertiary} />
                  <Text style={styles.emptyHeading}>You're all caught up</Text>
                  <Text style={styles.emptySubtext}>
                    Connects, games, and store news land here.
                  </Text>
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
            isFetchingNextPage ? (
              <ActivityIndicator color={colors.accent} style={styles.footer} />
            ) : null
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      )}
      <BroadcastSheet
        visible={!!openBroadcast}
        storeName={openBroadcast?.storeName ?? ''}
        title={openBroadcast?.title ?? ''}
        body={openBroadcast?.body ?? ''}
        onClose={() => setOpenBroadcast(null)}
      />
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
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
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
    fontFamily: typography.fontFamily.semiBold,
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
    fontSize: 11.5,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.63,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 13,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radii.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  rowUnread: {
    backgroundColor: colors.accentLight,
  },
  iconTile: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.chipBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: {
    flex: 1,
  },
  rowStore: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 11.5,
    color: colors.accent,
    marginBottom: 1,
  },
  rowTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 14.5,
    color: colors.textPrimary,
  },
  rowBody: {
    fontFamily: typography.fontFamily.medium,
    fontSize: 13.5,
    color: colors.textSecondary,
    marginTop: 3,
  },
  rowTime: {
    fontFamily: typography.fontFamily.medium,
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 5,
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: radii.full,
    backgroundColor: colors.accent,
    marginTop: 3,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  emptyHeading: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptySubtext: {
    fontFamily: typography.fontFamily.medium,
    fontSize: 13.5,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  footer: {
    paddingVertical: spacing.md,
  },
});
