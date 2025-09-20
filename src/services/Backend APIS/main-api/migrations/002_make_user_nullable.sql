-- Migration: allow anonymous uploads by making medical_records.user_id nullable
ALTER TABLE medical_records MODIFY COLUMN user_id INT DEFAULT NULL;
