import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { EventRemindersService } from '../event-reminders.service';

function makeQueueMock() {
  return {
    add: jest.fn().mockResolvedValue({}),
    getJob: jest.fn().mockResolvedValue(null),
  };
}

function makeJobMock() {
  return { remove: jest.fn().mockResolvedValue(undefined) };
}

// A future event 2 hours from now in a UTC-like timezone — both delays > 0.
function futureEvent(hoursFromNow = 2) {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
}

describe('EventRemindersService', () => {
  let service: EventRemindersService;
  let queue: ReturnType<typeof makeQueueMock>;

  beforeEach(async () => {
    queue = makeQueueMock();

    const module = await Test.createTestingModule({
      providers: [
        EventRemindersService,
        { provide: getQueueToken('event-reminders'), useValue: queue },
      ],
    }).compile();

    service = module.get(EventRemindersService);
  });

  // -------------------------------------------------------------------------
  // scheduleReminders
  // -------------------------------------------------------------------------

  describe('scheduleReminders', () => {
    const baseData = {
      eventId: 'evt1',
      eventName: 'Friday Night Magic',
      storeId: 'store1',
      storeName: 'Card Kingdom',
      timezone: 'America/Los_Angeles',
    };

    it('enqueues morning job with deterministic jobId', async () => {
      const startsAt = futureEvent(25); // 25h from now — morning of that day is in the future
      await service.scheduleReminders('u1', { ...baseData, startsAt });

      const morningCall = queue.add.mock.calls.find((c) => c[0] === 'morning');
      expect(morningCall).toBeDefined();
      expect(morningCall![2]).toMatchObject({ jobId: 'evt1:u1:morning' });
    });

    it('enqueues hour job with deterministic jobId', async () => {
      const startsAt = futureEvent(3); // T-60min delay is 2h from now — positive
      await service.scheduleReminders('u1', { ...baseData, startsAt });

      const hourCall = queue.add.mock.calls.find((c) => c[0] === 'hour');
      expect(hourCall).toBeDefined();
      expect(hourCall![2]).toMatchObject({ jobId: 'evt1:u1:hour' });
    });

    it('does not enqueue hour job when event starts in less than 60 minutes', async () => {
      const startsAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min from now
      await service.scheduleReminders('u1', { ...baseData, startsAt });

      const hourCall = queue.add.mock.calls.find((c) => c[0] === 'hour');
      expect(hourCall).toBeUndefined();
    });

    it('includes correct job data payload', async () => {
      const startsAt = futureEvent(3);
      await service.scheduleReminders('u1', { ...baseData, startsAt });

      const hourCall = queue.add.mock.calls.find((c) => c[0] === 'hour');
      expect(hourCall![1]).toMatchObject({
        userId: 'u1',
        eventId: 'evt1',
        storeId: 'store1',
        storeName: 'Card Kingdom',
        eventName: 'Friday Night Magic',
        startsAt: startsAt.toISOString(),
      });
    });

    it('defaults to America/Los_Angeles when timezone is null', async () => {
      const startsAt = futureEvent(25);
      // Should not throw even with null timezone
      await expect(
        service.scheduleReminders('u1', { ...baseData, timezone: null, startsAt }),
      ).resolves.not.toThrow();
    });

    it('does not enqueue morning job when morning time has already passed', async () => {
      // Event starts in 30 minutes — morning of today already passed
      const startsAt = new Date(Date.now() + 30 * 60 * 1000);
      await service.scheduleReminders('u1', { ...baseData, startsAt });

      const morningCall = queue.add.mock.calls.find((c) => c[0] === 'morning');
      expect(morningCall).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // cancelReminders
  // -------------------------------------------------------------------------

  describe('cancelReminders', () => {
    it('removes both morning and hour jobs when they exist', async () => {
      const morningJob = makeJobMock();
      const hourJob = makeJobMock();
      queue.getJob.mockResolvedValueOnce(morningJob).mockResolvedValueOnce(hourJob);

      await service.cancelReminders('u1', 'evt1');

      expect(morningJob.remove).toHaveBeenCalled();
      expect(hourJob.remove).toHaveBeenCalled();
    });

    it('looks up jobs using deterministic jobIds', async () => {
      queue.getJob.mockResolvedValue(null);

      await service.cancelReminders('u1', 'evt1');

      expect(queue.getJob).toHaveBeenCalledWith('evt1:u1:morning');
      expect(queue.getJob).toHaveBeenCalledWith('evt1:u1:hour');
    });

    it('does not throw when jobs do not exist (optional chaining)', async () => {
      queue.getJob.mockResolvedValue(null);
      await expect(service.cancelReminders('u1', 'evt1')).resolves.not.toThrow();
    });

    it('removes only the existing job when one job is missing', async () => {
      const morningJob = makeJobMock();
      queue.getJob
        .mockResolvedValueOnce(morningJob) // morning found
        .mockResolvedValueOnce(null); // hour not found

      await service.cancelReminders('u1', 'evt1');

      expect(morningJob.remove).toHaveBeenCalled();
    });
  });
});
