-- Migration: add_raw_message_keyword_provenance
-- Change: Store keyword-gate provenance on raw messages so classifier output
--         can preserve the matched keyword on created signal rows.

ALTER TABLE "raw_messages"
  ADD COLUMN "keyword_matched" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "matched_keyword" VARCHAR(120);

CREATE INDEX "raw_messages_keyword_matched_idx"
  ON "raw_messages"("keyword_matched");
