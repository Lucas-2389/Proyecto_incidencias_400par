-- migration 014: versioned territory, legacy identifiers and explicit resolution
-- statement
CREATE TABLE territory_versions (
  id CHAR(36) PRIMARY KEY,
  scope VARCHAR(80) NOT NULL,
  checksum CHAR(64) NOT NULL,
  metadata JSON NOT NULL,
  before_state JSON NOT NULL,
  report JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;
-- statement
CREATE TABLE territory_state (
  scope VARCHAR(80) PRIMARY KEY,
  version_id CHAR(36) NULL,
  CONSTRAINT fk_territory_version FOREIGN KEY (version_id) REFERENCES territory_versions(id)
) ENGINE=InnoDB;
-- statement
INSERT INTO territory_state (scope) VALUES ('ayacucho-metropolitan');
-- statement
CREATE TABLE territory_scope_districts (
  scope VARCHAR(80) NOT NULL,
  district_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (scope, district_id),
  CONSTRAINT fk_scope_district FOREIGN KEY (district_id) REFERENCES districts(id)
) ENGINE=InnoDB;
-- statement
CREATE TABLE district_aliases (
  legacy_id BIGINT UNSIGNED PRIMARY KEY,
  district_id BIGINT UNSIGNED NOT NULL,
  CONSTRAINT fk_alias_legacy FOREIGN KEY (legacy_id) REFERENCES districts(id),
  CONSTRAINT fk_alias_district FOREIGN KEY (district_id) REFERENCES districts(id)
) ENGINE=InnoDB;
-- statement
ALTER TABLE incident_locations
  ADD COLUMN territory_status VARCHAR(30) NOT NULL DEFAULT 'pending',
  ADD COLUMN territory_version_id CHAR(36) NULL,
  ADD CONSTRAINT fk_location_territory_version FOREIGN KEY (territory_version_id) REFERENCES territory_versions(id);
-- statement
ALTER TABLE sites
  ADD COLUMN territory_status VARCHAR(30) NOT NULL DEFAULT 'pending',
  ADD COLUMN territory_version_id CHAR(36) NULL,
  ADD CONSTRAINT fk_site_territory_version FOREIGN KEY (territory_version_id) REFERENCES territory_versions(id);
-- statement
ALTER TABLE audit_logs
  ADD COLUMN district_id BIGINT UNSIGNED NULL,
  ADD INDEX idx_audit_district (district_id, id),
  ADD CONSTRAINT fk_audit_district FOREIGN KEY (district_id) REFERENCES districts(id);
