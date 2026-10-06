-- migration 003: operational resources and routing catalogs
-- statement
CREATE TABLE personnel (
  id CHAR(36) NOT NULL,
  institution_id CHAR(36) NOT NULL,
  site_id CHAR(36) NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  role_description VARCHAR(100) NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_personnel_institution_code (institution_id, code),
  KEY idx_personnel_site_active (site_id, active),
  CONSTRAINT fk_personnel_institution FOREIGN KEY (institution_id) REFERENCES institutions(id),
  CONSTRAINT fk_personnel_site FOREIGN KEY (site_id) REFERENCES sites(id)
) ENGINE=InnoDB;
-- statement
CREATE TABLE units (
  id CHAR(36) NOT NULL,
  institution_id CHAR(36) NOT NULL,
  site_id CHAR(36) NOT NULL,
  code VARCHAR(50) NOT NULL,
  plate VARCHAR(30) NULL,
  type VARCHAR(80) NOT NULL,
  capacity_description VARCHAR(200) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'available',
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_units_institution_code (institution_id, code),
  KEY idx_units_site_status (site_id, status),
  CONSTRAINT fk_units_institution FOREIGN KEY (institution_id) REFERENCES institutions(id),
  CONSTRAINT fk_units_site FOREIGN KEY (site_id) REFERENCES sites(id),
  CONSTRAINT chk_units_status CHECK (status IN ('available', 'assigned', 'en_route', 'attending', 'returning', 'maintenance', 'out_of_service'))
) ENGINE=InnoDB;
-- statement
CREATE TABLE incident_categories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(60) NOT NULL,
  name VARCHAR(120) NOT NULL,
  family VARCHAR(30) NOT NULL,
  is_sensitive BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_incident_categories_code (code),
  KEY idx_incident_categories_family_active (family, active),
  CONSTRAINT chk_incident_categories_family CHECK (family IN ('emergency', 'security'))
) ENGINE=InnoDB;
-- statement
CREATE TABLE incident_subcategories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  category_id BIGINT UNSIGNED NOT NULL,
  code VARCHAR(60) NOT NULL,
  name VARCHAR(120) NOT NULL,
  is_sensitive BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_incident_subcategories_code (code),
  KEY idx_incident_subcategories_category_active (category_id, active),
  CONSTRAINT fk_incident_subcategories_category FOREIGN KEY (category_id) REFERENCES incident_categories(id)
) ENGINE=InnoDB;
-- statement
CREATE TABLE routing_rules (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  category_id BIGINT UNSIGNED NOT NULL,
  subcategory_id BIGINT UNSIGNED NULL,
  institution_type VARCHAR(30) NOT NULL,
  priority INT UNSIGNED NOT NULL DEFAULT 100,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  reason VARCHAR(300) NOT NULL,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_routing_rules_category_active (category_id, active, priority),
  KEY idx_routing_rules_subcategory (subcategory_id),
  KEY idx_routing_rules_type (institution_type),
  CONSTRAINT fk_routing_rules_category FOREIGN KEY (category_id) REFERENCES incident_categories(id),
  CONSTRAINT fk_routing_rules_subcategory FOREIGN KEY (subcategory_id) REFERENCES incident_subcategories(id),
  CONSTRAINT chk_routing_rules_type CHECK (institution_type IN ('pnp', 'samu', 'bomberos', 'municipalidad', 'otra'))
) ENGINE=InnoDB;
