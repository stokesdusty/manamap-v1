import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export interface ReminderJobData {
  userId: string;
  eventId: string;
  storeId: string;
  storeName: string;
  eventName: string;
  startsAt: string;
}

// Computes the UTC time corresponding to `hour:00` on the day of `date` in the given IANA timezone.
function morningOfAt(date: Date, timezone: string, hour = 9): Date {
  const localDate = date.toLocaleDateString('en-CA', { timeZone: timezone }); // YYYY-MM-DD
  const candidate = new Date(`${localDate}T${String(hour).padStart(2, '0')}:00:00Z`);
  const localTime = new Date(candidate.toLocaleString('en-US', { timeZone: timezone }));
  const offset = candidate.getTime() - localTime.getTime();
  return new Date(candidate.getTime() + offset);
}

@Injectable()
export class EventRemindersService {
  constructor(
    @InjectQueue('event-reminders') private readonly queue: Queue<ReminderJobData>,
  ) {}

  async scheduleReminders(
    userId: string,
    data: {
      eventId: string;
      eventName: string;
      startsAt: Date;
      storeId: string;
      storeName: string;
      timezone: string | null;
    },
  ) {
    const now = Date.now();
    const timezone = data.timezone ?? 'America/Los_Angeles';
    const jobData: ReminderJobData = {
      userId,
      eventId: data.eventId,
      storeId: data.storeId,
      storeName: data.storeName,
      eventName: data.eventName,
      startsAt: data.startsAt.toISOString(),
    };

    const morningTime = morningOfAt(data.startsAt, timezone);
    const morningDelay = morningTime.getTime() - now;
    if (morningDelay > 0) {
      await this.queue.add('morning', jobData, {
        jobId: `${data.eventId}:${userId}:morning`,
        delay: morningDelay,
      });
    }

    const hourDelay = data.startsAt.getTime() - 60 * 60 * 1000 - now;
    if (hourDelay > 0) {
      await this.queue.add('hour', jobData, {
        jobId: `${data.eventId}:${userId}:hour`,
        delay: hourDelay,
      });
    }
  }

  async cancelReminders(userId: string, eventId: string) {
    const [morningJob, hourJob] = await Promise.all([
      this.queue.getJob(`${eventId}:${userId}:morning`),
      this.queue.getJob(`${eventId}:${userId}:hour`),
    ]);
    await Promise.all([morningJob?.remove(), hourJob?.remove()]);
  }
}
