-- Add resume fields to user_profiles for AI resume parsing and job matching
ALTER TABLE user_profiles ADD COLUMN resume_summary TEXT DEFAULT NULL;
ALTER TABLE user_profiles ADD COLUMN resume_text TEXT DEFAULT NULL;
