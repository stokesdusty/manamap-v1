export class Expo {
  static isExpoPushToken() { return true; }
  chunkPushNotifications() { return []; }
  async sendPushNotificationsAsync() { return []; }
  async getPushNotificationReceiptsAsync() { return {}; }
}
export type ExpoPushMessage = unknown;
export type ExpoPushTicket = unknown;
export type ExpoPushReceiptId = string;
