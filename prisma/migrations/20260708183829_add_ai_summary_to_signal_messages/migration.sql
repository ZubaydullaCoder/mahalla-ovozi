-- AlterTable
ALTER TABLE "signal_messages" ADD COLUMN     "ai_summary" VARCHAR(500);

-- RenameIndex
ALTER INDEX "signal_messages_district_id_mahalla_id_category_telegram_timest" RENAME TO "signal_messages_district_id_mahalla_id_category_telegram_ti_idx";
