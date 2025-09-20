-- Migration: add blood_pressure and weight columns to medical_records
-- Run using the provided run_migrations.py script or apply manually.
ALTER TABLE medical_records
  ADD COLUMN IF NOT EXISTS blood_pressure VARCHAR(64) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS weight VARCHAR(64) DEFAULT NULL;
