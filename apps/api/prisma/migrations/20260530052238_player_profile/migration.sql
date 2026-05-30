/*
  Warnings:

  - You are about to drop the column `format_id` on the `deck_links` table. All the data in the column will be lost.
  - Added the required column `site` to the `deck_links` table without a default value. This is not possible if the table is not empty.
  - Made the column `url` on table `deck_links` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "DeckSite" AS ENUM ('MOXFIELD', 'ARCHIDEKT');

-- DropForeignKey
ALTER TABLE "deck_links" DROP CONSTRAINT "deck_links_format_id_fkey";

-- AlterTable
ALTER TABLE "deck_links" DROP COLUMN "format_id",
ADD COLUMN     "site" "DeckSite" NOT NULL,
ALTER COLUMN "url" SET NOT NULL;

-- AlterTable
ALTER TABLE "privacy_settings" ADD COLUMN     "discoverable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "show_decks" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "show_discord" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "show_met_history" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatar_colors" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "commander" TEXT,
ADD COLUMN     "formats" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "power_level" INTEGER,
ADD COLUMN     "pronouns" TEXT,
ADD COLUMN     "vibe" TEXT;
