-- migration 005: assignments, history, evidence, public information and audit
-- statement
CREATE TABLE institution_assignments (
  id CHAR(36) NOT NULL,
  incident_id CHAR(36) NOT NULL,
  institution_id CHAR(36) NOT NULL,
  site_id CHAR(36) NOT NULL,
  operator_user_id CHAR(36) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'assigned',
  reason VARCHAR(1000) NULL,
  assigned_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  closed_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_institution_assignments_incident_site (incident_id, site_id),
  KEY idx_institution_assignments_institution_status (institution_id, status),
  KEY idx_institution_assignments_site_status (site_id, status),
  KEY idx_institution_assignments_operator (operator_user_id),
  CONSTRAINT fk_institution_assignments_incident FOREIGN KEY (incident_id) REFERENCES incidents(id),
  CONSTRAINT fk_institution_assignments_institution FOREIGN KEY (institution_id) REFERENCES institutions(id),
  CONSTRAINT fk_institution_assignments_site FOREIGN KEY (site_id) REFERENCES sites(id),
  CONSTRAINT fk_institution_assignments_operator FOREIGN KEY (operator_user_id) REFERENCES users(id),
  CONSTRAINT chk_institution_assignments_status CHECK (status IN ('assigned', 'en_route', 'attending', 'resolved', 'closed'))
) ENGINE=InnoDB;
-- statement
CREATE TABLE unit_assignments (
  id CHAR(36) NOT NULL,
  institution_assignment_id CHAR(36) NOT NULL,
  unit_id CHAR(36) NOT NULL,
  assigned_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  released_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_unit_assignments_pair (institution_assignment_id, unit_id),
  KEY idx_unit_assignments_unit_active (unit_id, released_at),
  CONSTRAINT fk_unit_assignments_assignment FOREIGN KEY (institution_assignment_id) REFERENCES institution_assignments(id),
  CONSTRAINT fk_unit_assignments_unit FOREIGN KEY (unit_id) REFERENCES units(id)
) ENGINE=InnoDB;
-- statement
CREATE TABLE personnel_assignments (
  id CHAR(36) NOT NULL,
  institution_assignment_id CHAR(36) NOT NULL,
  personnel_id CHAR(36) NOT NULL,
  assigned_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  released_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_personnel_assignments_pair (institution_assignment_id, personnel_id),
  KEY idx_personnel_assignments_person_active (personnel_id, released_at),
  CONSTRAINT fk_personnel_assignments_assignment FOREIGN KEY (institution_assignment_id) REFERENCES institution_assignments(id),
  CONSTRAINT fk_personnel_assignments_person FOREIGN KEY (personnel_id) REFERENCES personnel(id)
) ENGINE=InnoDB;
-- statement
CREATE TABLE incident_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  incident_id CHAR(36) NOT NULL,
  institution_assignment_id CHAR(36) NULL,
  actor_user_id CHAR(36) NULL,
  event_type VARCHAR(60) NOT NULL,
  previous_value VARCHAR(60) NULL,
  new_value VARCHAR(60) NULL,
  note VARCHAR(1000) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_incident_history_incident_time (incident_id, created_at),
  KEY idx_incident_history_assignment_time (institution_assignment_id, created_at),
  KEY idx_incident_history_actor (actor_user_id),
  CONSTRAINT fk_incident_history_incident FOREIGN KEY (incident_id) REFERENCES incidents(id),
  CONSTRAINT fk_incident_history_assignment FOREIGN KEY (institution_assignment_id) REFERENCES institution_assignments(id),
  CONSTRAINT fk_incident_history_actor FOREIGN KEY (actor_user_id) REFERENCES users(id)
) ENGINE=InnoDB;
-- statement
CREATE TABLE evidence (
  id CHAR(36) NOT NULL,
  incident_id CHAR(36) NOT NULL,
  uploader_user_id CHAR(36) NULL,
  object_key VARCHAR(300) NOT NULL,
  media_type VARCHAR(40) NOT NULL,
  byte_size BIGINT UNSIGNED NOT NULL,
  sha256 CHAR(64) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_evidence_object_key (object_key),
  KEY idx_evidence_incident_time (incident_id, created_at),
  KEY idx_evidence_uploader (uploader_user_id),
  CONSTRAINT fk_evidence_incident FOREIGN KEY (incident_id) REFERENCES incidents(id),
  CONSTRAINT fk_evidence_uploader FOREIGN KEY (uploader_user_id) REFERENCES users(id),
  CONSTRAINT chk_evidence_media_type CHECK (media_type IN ('image/jpeg', 'image/png', 'image/webp'))
) ENGINE=InnoDB;
-- statement
CREATE TABLE directory_entries (
  id CHAR(36) NOT NULL,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  scope VARCHAR(20) NOT NULL,
  institution_id CHAR(36) NULL,
  site_id CHAR(36) NULL,
  district_id BIGINT UNSIGNED NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_directory_scope_active (scope, active),
  KEY idx_directory_district_active (district_id, active),
  KEY idx_directory_institution (institution_id),
  KEY idx_directory_site (site_id),
  CONSTRAINT fk_directory_institution FOREIGN KEY (institution_id) REFERENCES institutions(id),
  CONSTRAINT fk_directory_site FOREIGN KEY (site_id) REFERENCES sites(id),
  CONSTRAINT fk_directory_district FOREIGN KEY (district_id) REFERENCES districts(id),
  CONSTRAINT chk_directory_scope CHECK (scope IN ('national', 'local'))
) ENGINE=InnoDB;
-- statement
CREATE TABLE alerts (
  id CHAR(36) NOT NULL,
  author_user_id CHAR(36) NOT NULL,
  district_id BIGINT UNSIGNED NULL,
  type VARCHAR(60) NOT NULL,
  title VARCHAR(200) NOT NULL,
  message VARCHAR(2000) NOT NULL,
  valid_from DATETIME(3) NOT NULL,
  valid_until DATETIME(3) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_alerts_district_validity (district_id, active, valid_from, valid_until),
  KEY idx_alerts_author (author_user_id),
  CONSTRAINT fk_alerts_author FOREIGN KEY (author_user_id) REFERENCES users(id),
  CONSTRAINT fk_alerts_district FOREIGN KEY (district_id) REFERENCES districts(id),
  CONSTRAINT chk_alerts_validity CHECK (valid_until > valid_from)
) ENGINE=InnoDB;
-- statement
CREATE TABLE notifications (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  incident_id CHAR(36) NULL,
  alert_id CHAR(36) NULL,
  type VARCHAR(60) NOT NULL,
  title VARCHAR(200) NOT NULL,
  message VARCHAR(1000) NOT NULL,
  read_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_notifications_user_read_time (user_id, read_at, created_at),
  KEY idx_notifications_incident (incident_id),
  KEY idx_notifications_alert (alert_id),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_notifications_incident FOREIGN KEY (incident_id) REFERENCES incidents(id),
  CONSTRAINT fk_notifications_alert FOREIGN KEY (alert_id) REFERENCES alerts(id)
) ENGINE=InnoDB;
-- statement
CREATE TABLE audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_user_id CHAR(36) NULL,
  institution_id CHAR(36) NULL,
  site_id CHAR(36) NULL,
  correlation_id CHAR(36) NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id VARCHAR(64) NOT NULL,
  before_data JSON NULL,
  after_data JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_audit_actor_time (actor_user_id, created_at),
  KEY idx_audit_institution_time (institution_id, created_at),
  KEY idx_audit_entity_time (entity_type, entity_id, created_at),
  KEY idx_audit_site (site_id),
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users(id),
  CONSTRAINT fk_audit_institution FOREIGN KEY (institution_id) REFERENCES institutions(id),
  CONSTRAINT fk_audit_site FOREIGN KEY (site_id) REFERENCES sites(id)
) ENGINE=InnoDB;
