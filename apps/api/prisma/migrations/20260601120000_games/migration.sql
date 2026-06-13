-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DISPUTED');

-- AlterTable: add game_id to encounters
ALTER TABLE "encounters" ADD COLUMN "game_id" TEXT;

-- CreateTable: game_logs
CREATE TABLE "game_logs" (
    "id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "store_id" TEXT,
    "format" TEXT,
    "winner_id" TEXT NOT NULL,
    "status" "GameStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMP(3),

    CONSTRAINT "game_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: game_players
CREATE TABLE "game_players" (
    "id" TEXT NOT NULL,
    "game_log_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "deck" TEXT,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "game_players_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "game_players_game_log_id_user_id_key" ON "game_players"("game_log_id", "user_id");

-- AddForeignKey
ALTER TABLE "game_logs" ADD CONSTRAINT "game_logs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "game_logs" ADD CONSTRAINT "game_logs_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "game_logs" ADD CONSTRAINT "game_logs_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "game_players" ADD CONSTRAINT "game_players_game_log_id_fkey" FOREIGN KEY ("game_log_id") REFERENCES "game_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "game_players" ADD CONSTRAINT "game_players_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "encounters" ADD CONSTRAINT "encounters_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "game_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
