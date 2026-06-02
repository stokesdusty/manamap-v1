import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Expo } from 'expo-server-sdk';
import type { ExpoPushMessage } from 'expo-server-sdk';
import { PrismaService } from '../prisma/prisma.service';
import type { ReminderJobData } from './event-reminders.service';

@Processor('event-reminders')
export class EventRemindersProcessor extends WorkerHost {
  private readonly expo = new Expo();

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<ReminderJobData>): Promise<void> {
    if (job.name !== 'morning' && job.name !== 'hour') return;

    const { userId, eventId, storeId, storeName, eventName, startsAt } = job.data;

    // Skip if the event has already started
    if (new Date(startsAt) <= new Date()) return;

    // Verify the user is still an attendee
    const attendee = await this.prisma.eventAttendee.findUnique({
      where: { userId_eventId: { userId, eventId } },
    });
    if (!attendee) return;

    // Verify the event still exists
    const event = await this.prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
    if (!event) return;

    // TODO: respect notification opt-out when a preference field is added to PrivacySettings

    const isHour = job.name === 'hour';
    await this.sendPush(userId, {
      title: isHour ? 'Event starting soon' : 'Event reminder',
      body: isHour
        ? `${eventName} starts in about an hour at ${storeName}`
        : `${eventName} is today at ${storeName}`,
      data: { type: 'event_reminder', eventId, storeId },
    });
  }

  private async sendPush(
    userId: string,
    payload: { title: string; body: string; data?: Record<string, unknown> },
  ) {
    const rows = await this.prisma.pushToken.findMany({ where: { userId } });
    const valid = rows.filter((r) => Expo.isExpoPushToken(r.token));
    if (!valid.length) return;

    const messages: ExpoPushMessage[] = valid.map((r) => ({
      to: r.token,
      title: payload.title,
      body: payload.body,
      ...(payload.data !== undefined ? { data: payload.data } : {}),
    }));

    try {
      const chunks = this.expo.chunkPushNotifications(messages);
      for (const chunk of chunks) {
        await this.expo.sendPushNotificationsAsync(chunk);
      }
    } catch {
      // Push failures are non-fatal
    }
  }
}
