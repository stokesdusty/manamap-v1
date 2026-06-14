-- Add event_reminders opt-out to privacy_settings
ALTER TABLE "privacy_settings" ADD COLUMN "event_reminders" BOOLEAN NOT NULL DEFAULT true;
