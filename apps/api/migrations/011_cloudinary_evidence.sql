-- migration 011: evidence storage provider and remote image metadata
-- statement
ALTER TABLE evidence
  ADD COLUMN storage_provider VARCHAR(20) NOT NULL DEFAULT 'local',
  ADD COLUMN secure_url VARCHAR(2048) NULL,
  ADD CONSTRAINT chk_evidence_storage_provider CHECK (storage_provider IN ('local', 'cloudinary'));
