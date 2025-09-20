-- Migration: add columns required by frontend
ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255) DEFAULT '';

ALTER TABLE medical_records
  ADD COLUMN IF NOT EXISTS age INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sex VARCHAR(32) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS record_date DATE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS image_url VARCHAR(1024) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS doctor_name VARCHAR(255) DEFAULT NULL;

-- Note: MySQL versions older than 8 do not support IF NOT EXISTS for ADD COLUMN;
-- if your MySQL rejects it, run the following instead for each column:
-- ALTER TABLE users ADD COLUMN name VARCHAR(255) DEFAULT ''; -- if missing
-- ALTER TABLE medical_records ADD COLUMN age INT DEFAULT NULL; -- etc.
