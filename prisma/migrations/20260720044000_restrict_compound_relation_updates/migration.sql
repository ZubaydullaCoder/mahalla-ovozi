-- Prevent referenced-key updates from cascading into topic primary keys or
-- dependent captured-message scope columns.
ALTER TABLE "topics"
DROP CONSTRAINT "topics_anchor_captured_message_id_id_district_id_mahalla_i_fkey";

ALTER TABLE "topics"
ADD CONSTRAINT "topics_anchor_captured_message_id_id_district_id_mahalla_i_fkey"
FOREIGN KEY ("anchor_captured_message_id", "id", "district_id", "mahalla_id")
REFERENCES "captured_messages"("id", "topic_id", "district_id", "mahalla_id")
ON DELETE RESTRICT
ON UPDATE RESTRICT;

ALTER TABLE "captured_messages"
DROP CONSTRAINT "captured_messages_promotion_triggered_by_id_district_id_ma_fkey";

ALTER TABLE "captured_messages"
ADD CONSTRAINT "captured_messages_promotion_triggered_by_id_district_id_ma_fkey"
FOREIGN KEY ("promotion_triggered_by_id", "district_id", "mahalla_id")
REFERENCES "captured_messages"("id", "district_id", "mahalla_id")
ON DELETE RESTRICT
ON UPDATE RESTRICT;
