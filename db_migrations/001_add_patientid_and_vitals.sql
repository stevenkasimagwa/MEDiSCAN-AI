-- Migration: Add patient_id, height, temperature to medical_records
-- Run this against your MySQL database used by the main-api service.

ALTER TABLE medical_records
  ADD COLUMN patient_id VARCHAR(64) NULL,
  ADD COLUMN height FLOAT NULL,
  ADD COLUMN temperature FLOAT NULL;

-- Ensure weight column exists (if not, uncomment the next line):
-- ALTER TABLE medical_records ADD COLUMN weight FLOAT NULL;

-- Optional: create an index for faster patient lookups
CREATE INDEX IF NOT EXISTS idx_medical_records_patient_id ON medical_records(patient_id);

-- Optional: if you want patient_id globally unique, create unique index (be careful with existing duplicates):
-- CREATE UNIQUE INDEX ux_medical_records_patient_id ON medical_records(patient_id);
