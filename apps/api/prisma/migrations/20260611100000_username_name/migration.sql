-- Add name (real/chosen name) to users
ALTER TABLE users
  ADD COLUMN name TEXT;

-- Add share_name_with_contacts flag to privacy_settings
ALTER TABLE privacy_settings
  ADD COLUMN share_name_with_contacts BOOLEAN NOT NULL DEFAULT FALSE;
