-- CreateEnum
CREATE TYPE "EndorsementTag" AS ENUM ('GREAT_HOST', 'GOOD_SPORT', 'TAUGHT_THE_FORMAT', 'FAST_PLAYER', 'WELL_BREWED_DECK', 'GENEROUS');

-- CreateTable
CREATE TABLE "endorsements" (
    "id" TEXT NOT NULL,
    "from_user_id" TEXT NOT NULL,
    "to_user_id" TEXT NOT NULL,
    "game_log_id" TEXT NOT NULL,
    "tag" "EndorsementTag" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "endorsements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "endorsements_to_user_id_idx" ON "endorsements"("to_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "endorsements_from_user_id_to_user_id_game_log_id_key" ON "endorsements"("from_user_id", "to_user_id", "game_log_id");

-- AddForeignKey
ALTER TABLE "endorsements" ADD CONSTRAINT "endorsements_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "endorsements" ADD CONSTRAINT "endorsements_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "endorsements" ADD CONSTRAINT "endorsements_game_log_id_fkey" FOREIGN KEY ("game_log_id") REFERENCES "game_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
