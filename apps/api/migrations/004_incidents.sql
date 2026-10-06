-- migration 004: incidents, locations and idempotency
-- statement
CREATE TABLE incidents (
  id CHAR(36) NOT NULL,
  reference VARCHAR(30) NOT NULL,
  reporter_user_id CHAR(36) NULL,
  created_by_user_id CHAR(36) NULL,
  category_id BIGINT UNSIGNED NOT NULL,
  subcategory_id BIGINT UNSIGNED NULL,
  source VARCHAR(20) NOT NULL,
  description VARCHAR(2000) NOT NULL,
  affected_people INT UNSIGNED NULL,
  occurred_at DATETIME(3) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'reported',
  verification_status VARCHAR(30) NOT NULL DEFAULT 'unverified',
  priority VARCHAR(20) NOT NULL DEFAULT 'normal',
  caller_contact VARCHAR(100) NULL,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_incidents_reference (reference),
  KEY idx_incidents_reporter_created (reporter_user_id, created_at),
  KEY idx_incidents_status_created (status, created_at),
  KEY idx_incidents_category_created (category_id, created_at),
  KEY idx_incidents_source (source),
  KEY idx_incidents_subcategory (subcategory_id),
  KEY idx_incidents_creator (created_by_user_id),
  CONSTRAINT fk_incidents_reporter FOREIGN KEY (reporter_user_id) REFERENCES users(id),
  CONSTRAINT fk_incidents_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id),
  CONSTRAINT fk_incidents_category FOREIGN KEY (category_id) REFERENCES incident_categories(id),
  CONSTRAINT fk_incidents_subcategory FOREIGN KEY (subcategory_id) REFERENCES incident_subcategories(id),
  CONSTRAINT chk_incidents_source CHECK (source IN ('MOBILE_APP', 'PHONE')),
  CONSTRAINT chk_incidents_status CHECK (status IN ('reported', 'verifying', 'assigned', 'en_route', 'attending', 'resolved', 'closed')),
  CONSTRAINT chk_incidents_verification CHECK (verification_status IN ('unverified', 'verified', 'unverifiable', 'false', 'duplicate')),
  CONSTRAINT chk_incidents_priority CHECK (priority IN ('low', 'normal', 'high', 'critical'))
) ENGINE=InnoDB;
-- statement
CREATE TABLE incident_locations (
  incident_id CHAR(36) NOT NULL,
  location_point POINT NOT NULL SRID 4326,
  accuracy_meters DECIMAL(10,2) NULL,
  captured_at DATETIME(3) NULL,
  reference_text VARCHAR(500) NULL,
  district_id BIGINT UNSIGNED NULL,
  sector_id BIGINT UNSIGNED NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (incident_id),
  KEY idx_incident_locations_district (district_id),
  KEY idx_incident_locations_sector (sector_id),
  SPATIAL KEY idx_incident_locations_point (location_point),
  CONSTRAINT fk_incident_locations_incident FOREIGN KEY (incident_id) REFERENCES incidents(id),
  CONSTRAINT fk_incident_locations_district FOREIGN KEY (district_id) REFERENCES districts(id),
  CONSTRAINT fk_incident_locations_sector FOREIGN KEY (sector_id) REFERENCES sectors(id),
  CONSTRAINT chk_incident_locations_accuracy CHECK (accuracy_meters IS NULL OR accuracy_meters >= 0)
) ENGINE=InnoDB;
-- statement
CREATE TABLE client_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  scope_type VARCHAR(20) NOT NULL,
  scope_id VARCHAR(64) NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  incident_id CHAR(36) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_client_requests_scope_key (scope_type, scope_id, idempotency_key),
  KEY idx_client_requests_incident (incident_id),
  CONSTRAINT fk_client_requests_incident FOREIGN KEY (incident_id) REFERENCES incidents(id),
  CONSTRAINT chk_client_requests_scope CHECK (scope_type IN ('user', 'guest', 'operator'))
) ENGINE=InnoDB;
-- statement
CREATE TABLE incident_duplicates (
  duplicate_incident_id CHAR(36) NOT NULL,
  primary_incident_id CHAR(36) NOT NULL,
  linked_by_user_id CHAR(36) NOT NULL,
  reason VARCHAR(1000) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (duplicate_incident_id),
  KEY idx_incident_duplicates_primary (primary_incident_id),
  KEY idx_incident_duplicates_actor (linked_by_user_id),
  CONSTRAINT fk_incident_duplicates_duplicate FOREIGN KEY (duplicate_incident_id) REFERENCES incidents(id),
  CONSTRAINT fk_incident_duplicates_primary FOREIGN KEY (primary_incident_id) REFERENCES incidents(id),
  CONSTRAINT fk_incident_duplicates_actor FOREIGN KEY (linked_by_user_id) REFERENCES users(id),
  CONSTRAINT chk_incident_duplicates_distinct CHECK (duplicate_incident_id <> primary_incident_id)
) ENGINE=InnoDB;
