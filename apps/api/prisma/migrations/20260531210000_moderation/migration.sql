-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'BANNED');

-- CreateEnum
CREATE TYPE "ModerationActionType" AS ENUM ('DISMISS', 'WARN', 'SUSPEND', 'BAN');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "moderation_status" "ModerationStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "users" ADD COLUMN "suspended_until" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "reports" ADD COLUMN "resolved_by_id" TEXT;
ALTER TABLE "reports" ADD COLUMN "resolved_at" TIMESTAMP(3);
ALTER TABLE "reports" ADD COLUMN "resolution_note" TEXT;

-- CreateTable
CREATE TABLE "moderation_actions" (
    "id" TEXT NOT NULL,
    "report_id" TEXT,
    "target_user_id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "action" "ModerationActionType" NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_actions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
