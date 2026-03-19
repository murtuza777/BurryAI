PRAGMA foreign_keys = ON;

ALTER TABLE user_profiles ADD COLUMN profession TEXT;
ALTER TABLE user_profiles ADD COLUMN skills_json TEXT;
ALTER TABLE user_profiles ADD COLUMN other_talents_json TEXT;
ALTER TABLE user_profiles ADD COLUMN preferred_work_mode TEXT CHECK (preferred_work_mode IN ('local', 'remote', 'hybrid'));
ALTER TABLE user_profiles ADD COLUMN city TEXT;
ALTER TABLE user_profiles ADD COLUMN state_region TEXT;
ALTER TABLE user_profiles ADD COLUMN remote_regions_json TEXT;
ALTER TABLE user_profiles ADD COLUMN opportunity_radius_km INTEGER NOT NULL DEFAULT 25 CHECK (opportunity_radius_km >= 1 AND opportunity_radius_km <= 500);
ALTER TABLE user_profiles ADD COLUMN min_hourly_rate REAL NOT NULL DEFAULT 0 CHECK (min_hourly_rate >= 0);

CREATE INDEX IF NOT EXISTS idx_user_profiles_profession ON user_profiles(profession);
CREATE INDEX IF NOT EXISTS idx_user_profiles_city_country ON user_profiles(city, country);
