-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('DISCORD', 'INSTAGRAM', 'TWITCH', 'YOUTUBE', 'X', 'TIKTOK', 'FACEBOOK', 'WEBSITE', 'PHONE');

-- CreateEnum
CREATE TYPE "SocialVisibility" AS ENUM ('PUBLIC', 'FRIENDS', 'HIDDEN');

-- CreateTable
CREATE TABLE "social_links" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "value" TEXT NOT NULL,
    "visibility" "SocialVisibility" NOT NULL DEFAULT 'PUBLIC',
    "sort" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "social_links_user_id_platform_key" ON "social_links"("user_id", "platform");

-- CreateIndex
CREATE INDEX "social_links_user_id_idx" ON "social_links"("user_id");

-- AddForeignKey
ALTER TABLE "social_links" ADD CONSTRAINT "social_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
