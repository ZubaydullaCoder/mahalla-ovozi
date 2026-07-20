-- CreateEnum
CREATE TYPE "ProcessingState" AS ENUM ('queued', 'processing', 'retry', 'dead_letter', 'complete');

-- CreateEnum
CREATE TYPE "FinalDisposition" AS ENUM ('new_topic', 'attached', 'irrelevant');

-- CreateEnum
CREATE TYPE "TopicCategoryValue" AS ENUM ('water', 'electricity', 'gas', 'waste');

-- CreateTable
CREATE TABLE "topics" (
    "id" SERIAL NOT NULL,
    "district_id" INTEGER NOT NULL,
    "mahalla_id" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "summary_model" VARCHAR(100) NOT NULL,
    "summary_version" VARCHAR(50) NOT NULL,
    "first_activity_at" TIMESTAMP(3) NOT NULL,
    "latest_activity_at" TIMESTAMP(3) NOT NULL,
    "anchor_captured_message_id" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topic_categories" (
    "id" SERIAL NOT NULL,
    "topic_id" INTEGER NOT NULL,
    "category" "TopicCategoryValue" NOT NULL,

    CONSTRAINT "topic_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "captured_messages" (
    "id" SERIAL NOT NULL,
    "telegram_update_id" BIGINT NOT NULL,
    "telegram_chat_id" BIGINT NOT NULL,
    "telegram_message_id" INTEGER,
    "reply_to_chat_id" BIGINT,
    "reply_to_message_id" INTEGER,
    "district_id" INTEGER NOT NULL,
    "mahalla_id" INTEGER NOT NULL,
    "sender_stable_id" BIGINT,
    "sender_display_name" VARCHAR(300),
    "sender_username" VARCHAR(100),
    "text" TEXT,
    "text_source" VARCHAR(10) NOT NULL,
    "telegram_timestamp" TIMESTAMP(3) NOT NULL,
    "processing_state" "ProcessingState" NOT NULL DEFAULT 'queued',
    "final_disposition" "FinalDisposition",
    "final_disposition_at" TIMESTAMP(3),
    "topic_id" INTEGER,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "next_retry_at" TIMESTAMP(3),
    "last_error" TEXT,
    "dead_lettered_at" TIMESTAMP(3),
    "text_expires_at" TIMESTAMP(3),
    "disposition_expires_at" TIMESTAMP(3),
    "promoted_from_irrelevant_at" TIMESTAMP(3),
    "promotion_triggered_by_id" INTEGER,
    "replay_attempt_at" TIMESTAMP(3),
    "replay_audit_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    -- Database-enforced lifecycle constraints (AC6 - Lifecycle Invariants)
    CONSTRAINT "captured_messages_attempt_count_non_negative" CHECK ("attempt_count" >= 0),
    CONSTRAINT "captured_messages_reply_ids_paired" CHECK (
        ("reply_to_chat_id" IS NULL AND "reply_to_message_id" IS NULL)
        OR
        ("reply_to_chat_id" IS NOT NULL AND "reply_to_message_id" IS NOT NULL)
    ),

    CONSTRAINT "captured_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "topics_district_id_mahalla_id_latest_activity_at_idx" ON "topics"("district_id", "mahalla_id", "latest_activity_at");

-- CreateIndex
CREATE INDEX "topics_district_id_latest_activity_at_idx" ON "topics"("district_id", "latest_activity_at");

-- CreateIndex
CREATE UNIQUE INDEX "topics_id_district_id_mahalla_id_key" ON "topics"("id", "district_id", "mahalla_id");

-- CreateIndex
CREATE INDEX "topic_categories_category_topic_id_idx" ON "topic_categories"("category", "topic_id");

-- CreateIndex
CREATE UNIQUE INDEX "topic_categories_topic_id_category_key" ON "topic_categories"("topic_id", "category");

-- CreateIndex
CREATE UNIQUE INDEX "captured_messages_telegram_update_id_key" ON "captured_messages"("telegram_update_id");

-- CreateIndex
CREATE INDEX "captured_messages_district_id_mahalla_id_processing_state_t_idx" ON "captured_messages"("district_id", "mahalla_id", "processing_state", "telegram_timestamp", "id");

-- CreateIndex
CREATE INDEX "captured_messages_topic_id_telegram_timestamp_id_idx" ON "captured_messages"("topic_id", "telegram_timestamp", "id");

-- CreateIndex
CREATE INDEX "captured_messages_district_id_processing_state_next_retry_a_idx" ON "captured_messages"("district_id", "processing_state", "next_retry_at");

-- CreateIndex
CREATE INDEX "captured_messages_district_id_telegram_timestamp_idx" ON "captured_messages"("district_id", "telegram_timestamp");

-- CreateIndex (partial): text expiry for irrelevant messages
CREATE INDEX "captured_messages_text_expires_at_idx" ON "captured_messages"("text_expires_at") WHERE ("final_disposition" = 'irrelevant');

-- CreateIndex (partial): disposition metadata expiry for irrelevant messages
CREATE INDEX "captured_messages_disposition_expires_at_idx" ON "captured_messages"("disposition_expires_at") WHERE ("final_disposition" = 'irrelevant');

-- CreateIndex (partial): dead-letter purge
CREATE INDEX "captured_messages_dead_lettered_at_idx" ON "captured_messages"("dead_lettered_at") WHERE ("processing_state" = 'dead_letter');

-- CreateIndex
CREATE UNIQUE INDEX "captured_messages_id_district_id_mahalla_id_key" ON "captured_messages"("id", "district_id", "mahalla_id");

-- CreateIndex
CREATE UNIQUE INDEX "captured_messages_id_topic_id_district_id_mahalla_id_key" ON "captured_messages"("id", "topic_id", "district_id", "mahalla_id");

-- CreateIndex (defensive message uniqueness; enforced only when telegram_message_id is non-null)
CREATE UNIQUE INDEX "captured_messages_telegram_chat_id_telegram_message_id_key" ON "captured_messages"("telegram_chat_id", "telegram_message_id");

-- AddForeignKey: Topic → Mahalla (direct compound relation; rejects invalid district/mahalla pairs)
ALTER TABLE "topics" ADD CONSTRAINT "topics_mahalla_id_district_id_fkey" FOREIGN KEY ("mahalla_id", "district_id") REFERENCES "mahallas"("id", "district_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: Topic → CapturedMessage (anchor membership; guarantees anchor is member of its topic)
ALTER TABLE "topics" ADD CONSTRAINT "topics_anchor_captured_message_id_id_district_id_mahalla_i_fkey" FOREIGN KEY ("anchor_captured_message_id", "id", "district_id", "mahalla_id") REFERENCES "captured_messages"("id", "topic_id", "district_id", "mahalla_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: TopicCategory → Topic (cascade delete)
ALTER TABLE "topic_categories" ADD CONSTRAINT "topic_categories_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: CapturedMessage → Mahalla (direct compound relation; enforced even when topic_id is null)
ALTER TABLE "captured_messages" ADD CONSTRAINT "captured_messages_mahalla_id_district_id_fkey" FOREIGN KEY ("mahalla_id", "district_id") REFERENCES "mahallas"("id", "district_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: CapturedMessage → Topic (compound key enforces same mahalla/district scope; Restrict prevents composite SetNull)
ALTER TABLE "captured_messages" ADD CONSTRAINT "captured_messages_topic_id_district_id_mahalla_id_fkey" FOREIGN KEY ("topic_id", "district_id", "mahalla_id") REFERENCES "topics"("id", "district_id", "mahalla_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: CapturedMessage → CapturedMessage (promotion trigger; must match same scope)
ALTER TABLE "captured_messages" ADD CONSTRAINT "captured_messages_promotion_triggered_by_id_district_id_ma_fkey" FOREIGN KEY ("promotion_triggered_by_id", "district_id", "mahalla_id") REFERENCES "captured_messages"("id", "district_id", "mahalla_id") ON DELETE RESTRICT ON UPDATE CASCADE;
