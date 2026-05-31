-- DropForeignKey
ALTER TABLE "encounters" DROP CONSTRAINT "encounters_format_id_fkey";

-- AlterTable
ALTER TABLE "connections" ADD COLUMN     "note" TEXT,
ADD COLUMN     "via" TEXT;

-- AlterTable
ALTER TABLE "encounters" ALTER COLUMN "format_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "push_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "push_tokens_token_key" ON "push_tokens"("token");

-- AddForeignKey
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_format_id_fkey" FOREIGN KEY ("format_id") REFERENCES "formats"("id") ON DELETE SET NULL ON UPDATE CASCADE;
