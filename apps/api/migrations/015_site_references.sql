-- migration 015: documentary references, separate from dispatch sites
-- statement
CREATE TABLE site_references (
  id VARCHAR(80) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  institution_type VARCHAR(30) NOT NULL,
  district_code CHAR(6) NOT NULL,
  address VARCHAR(300) NULL,
  sources JSON NOT NULL,
  notes TEXT NOT NULL,
  latitude DECIMAL(10,7) NULL,
  longitude DECIMAL(10,7) NULL,
  verification_method VARCHAR(30) NULL,
  location_source VARCHAR(1000) NULL,
  reviewed_at DATETIME(3) NULL,
  reviewed_by CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT chk_reference_type CHECK (institution_type IN ('municipalidad', 'pnp', 'samu', 'bomberos')),
  CONSTRAINT chk_reference_coordinates CHECK (
    (latitude IS NULL AND longitude IS NULL) OR
    (latitude IS NOT NULL AND longitude IS NOT NULL AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)),
  CONSTRAINT fk_reference_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id),
  INDEX idx_reference_district (district_code)
) ENGINE=InnoDB;
