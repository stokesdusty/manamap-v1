import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { GamificationService } from './gamification.service';

@Processor('gamification')
export class LeaderboardProcessor extends WorkerHost {
  private readonly logger = new Logger(LeaderboardProcessor.name);

  constructor(private readonly gamification: GamificationService) {
    super();
  }

  async process(job: Job<{ storeId: string }>): Promise<void> {
    if (job.name === 'leaderboard:refresh') {
      await this.gamification.refreshLeaderboard(job.data.storeId);
    }
  }
}
