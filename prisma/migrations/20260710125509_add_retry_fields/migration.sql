-- AlterTable
ALTER TABLE "raw_messages" ADD COLUMN     "attempt_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "dead_lettered_at" TIMESTAMP(3),
ADD COLUMN     "last_attempted_at" TIMESTAMP(3),
ADD COLUMN     "last_error" TEXT,
ADD COLUMN     "next_retry_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "raw_messages_district_id_id_idx" ON "raw_messages"("district_id", "id");

-- CreateIndex
CREATE INDEX "raw_messages_district_id_next_retry_at_idx" ON "raw_messages"("district_id", "next_retry_at");

-- CreateIndex
CREATE INDEX "raw_messages_district_id_dead_lettered_at_idx" ON "raw_messages"("district_id", "dead_lettered_at");
