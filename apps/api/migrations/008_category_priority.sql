-- migration 008: configurable initial incident priority
-- statement
ALTER TABLE incident_categories
  ADD COLUMN default_priority VARCHAR(20) NOT NULL DEFAULT 'normal',
  ADD CONSTRAINT chk_incident_categories_priority CHECK (default_priority IN ('low', 'normal', 'high', 'critical'));
