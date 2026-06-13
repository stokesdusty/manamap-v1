import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { api } from '../api/client';
import { navigationRef } from '../lib/navigationRef';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function registerPushToken() {
  const perms = await Notifications.getPermissionsAsync();
  let granted = perms.granted;

  if (!granted) {
    const requested = await Notifications.requestPermissionsAsync();
    granted = requested.granted;
  }

  if (!granted) return;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  const opts = projectId !== undefined ? { projectId } : {};
  const tokenData = await Notifications.getExpoPushTokenAsync(opts);

  await api.post('/v1/me/push-token', { token: tokenData.data });
}

export function usePushNotifications(isAuthenticated: boolean) {
  const responseSub = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    void registerPushToken().catch(() => {
      // Push setup failure must not crash the app
    });

    responseSub.current = Notifications.addNotificationResponseReceivedListener((response) => {
      if (!navigationRef.isReady()) return;
      const data = response.notification.request.content.data as Record<string, unknown>;
      const type = data.type as string | undefined;

      switch (type) {
        case 'connection_request':
          navigationRef.navigate('Main');
          break;
        case 'connection_accepted': {
          const connectionId = data.connectionId as string | undefined;
          if (connectionId) {
            navigationRef.navigate('Connected', { connectionId });
          } else {
            navigationRef.navigate('Main');
          }
          break;
        }
        case 'pod_join_request':
        case 'pod_approved':
        case 'lfg_join_request': {
          const podId = data.podId as string | undefined;
          if (podId) {
            navigationRef.navigate('Pod', { podId });
          } else {
            navigationRef.navigate('Main');
          }
          break;
        }
        case 'game_confirm':
        case 'game_disputed':
          navigationRef.navigate('Main');
          break;
        case 'event_reminder':
        case 'store_broadcast':
          navigationRef.navigate('Main');
          break;
        default:
          break;
      }
    });

    return () => {
      responseSub.current?.remove();
    };
  }, [isAuthenticated]);
}
