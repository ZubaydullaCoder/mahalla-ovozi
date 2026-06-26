-- Migration: add_dashboard_query_indexes
-- Change: Add compound indexes for dashboard, context drawer, and latest batch lookups.

CREATE INDEX "signal_messages_district_id_telegram_timestamp_idx"
  ON "signal_messages"("district_id", "telegram_timestamp");

CREATE INDEX "signal_messages_district_id_mahalla_id_category_telegram_timestamp_idx"
  ON "signal_messages"("district_id", "mahalla_id", "category", "telegram_timestamp");

CREATE INDEX "batch_health_district_id_completed_at_idx"
  ON "batch_health"("district_id", "completed_at");
