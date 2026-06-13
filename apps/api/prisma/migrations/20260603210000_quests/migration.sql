-- CreateEnum
CREATE TYPE "QuestPeriod" AS ENUM ('MONTHLY');

-- CreateTable
CREATE TABLE "quests" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT NOT NULL DEFAULT '🎯',
    "criteria" JSONB NOT NULL,
    "period" "QuestPeriod" NOT NULL DEFAULT 'MONTHLY',
    "reward_badge_id" TEXT,
    "active_from" TIMESTAMP(3) NOT NULL,
    "active_to" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quest_progress" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "quest_id" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "quest_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quests_code_key" ON "quests"("code");

-- CreateIndex
CREATE UNIQUE INDEX "quest_progress_user_id_quest_id_key" ON "quest_progress"("user_id", "quest_id");

-- AddForeignKey
ALTER TABLE "quests" ADD CONSTRAINT "quests_reward_badge_id_fkey" FOREIGN KEY ("reward_badge_id") REFERENCES "badges"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quest_progress" ADD CONSTRAINT "quest_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quest_progress" ADD CONSTRAINT "quest_progress_quest_id_fkey" FOREIGN KEY ("quest_id") REFERENCES "quests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
