import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { api } from '../api/client';
import { navigationRef } from '../lib/navigationRef';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
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
      const data = response.notification.request.content.data as Record<string, unknown>;
      const connectionId = data.connectionId as string | undefined;

      if (!connectionId || !navigationRef.isReady()) return;

      if (data.type === 'connection_request') {
        navigationRef.navigate('Main');
      } else if (data.type === 'connection_accepted') {
        navigationRef.navigate('Connected', { connectionId });
      }
    });

    return () => {
      responseSub.current?.remove();
    };
  }, [isAuthenticated]);
}
