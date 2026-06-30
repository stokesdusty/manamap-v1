import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { NotificationKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { ReminderJobData } from './event-reminders.service';

@Processor('event-reminders')
export class EventRemindersProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {
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
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true },
    });
    if (!event) return;

    // Respect notification opt-out (defaults to true when no row exists)
    const privacy = await this.prisma.privacySettings.findUnique({
      where: { userId },
      select: { eventReminders: true },
    });
    if (privacy?.eventReminders === false) return;

    const isHour = job.name === 'hour';
    await this.notifications.create(userId, {
      kind: NotificationKind.EVENT_REMINDER,
      title: isHour ? 'Event starting soon' : 'Event reminder',
      body: isHour
        ? `${eventName} starts in about an hour at ${storeName}`
        : `${eventName} is today at ${storeName}`,
      data: { type: 'event_reminder', eventId, storeId },
    });
  }
}
