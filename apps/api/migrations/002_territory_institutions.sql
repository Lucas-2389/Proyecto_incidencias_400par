-- migration 002: territory, institutions, sites and coverage
-- statement
CREATE TABLE departments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(120) NOT NULL,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_departments_code (code)
) ENGINE=InnoDB;
-- statement
CREATE TABLE provinces (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  department_id BIGINT UNSIGNED NOT NULL,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(120) NOT NULL,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_provinces_code (code),
  KEY idx_provinces_department (department_id),
  CONSTRAINT fk_provinces_department FOREIGN KEY (department_id) REFERENCES departments(id)
) ENGINE=InnoDB;
-- statement
CREATE TABLE districts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  province_id BIGINT UNSIGNED NOT NULL,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(120) NOT NULL,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_districts_code (code),
  KEY idx_districts_province (province_id),
  CONSTRAINT fk_districts_province FOREIGN KEY (province_id) REFERENCES provinces(id)
) ENGINE=InnoDB;
-- statement
CREATE TABLE district_boundaries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  district_id BIGINT UNSIGNED NOT NULL,
  area MULTIPOLYGON NOT NULL SRID 4326,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_district_boundaries_district (district_id),
  SPATIAL KEY idx_district_boundaries_area (area),
  CONSTRAINT fk_district_boundaries_district FOREIGN KEY (district_id) REFERENCES districts(id)
) ENGINE=InnoDB;
-- statement
CREATE TABLE sectors (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  district_id BIGINT UNSIGNED NOT NULL,
  code VARCHAR(30) NOT NULL,
  name VARCHAR(120) NOT NULL,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_sectors_code (code),
  KEY idx_sectors_district (district_id),
  CONSTRAINT fk_sectors_district FOREIGN KEY (district_id) REFERENCES districts(id)
) ENGINE=InnoDB;
-- statement
CREATE TABLE sector_boundaries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sector_id BIGINT UNSIGNED NOT NULL,
  area MULTIPOLYGON NOT NULL SRID 4326,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_sector_boundaries_sector (sector_id),
  SPATIAL KEY idx_sector_boundaries_area (area),
  CONSTRAINT fk_sector_boundaries_sector FOREIGN KEY (sector_id) REFERENCES sectors(id)
) ENGINE=InnoDB;
-- statement
CREATE TABLE institutions (
  id CHAR(36) NOT NULL,
  name VARCHAR(200) NOT NULL,
  type VARCHAR(30) NOT NULL,
  contact_phone VARCHAR(40) NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_institutions_type_active (type, active),
  CONSTRAINT chk_institutions_type CHECK (type IN ('pnp', 'samu', 'bomberos', 'municipalidad', 'otra'))
) ENGINE=InnoDB;
-- statement
CREATE TABLE sites (
  id CHAR(36) NOT NULL,
  institution_id CHAR(36) NOT NULL,
  district_id BIGINT UNSIGNED NULL,
  name VARCHAR(200) NOT NULL,
  address VARCHAR(300) NULL,
  contact_phone VARCHAR(40) NULL,
  location POINT NOT NULL SRID 4326,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_sites_institution_active (institution_id, active),
  KEY idx_sites_district (district_id),
  SPATIAL KEY idx_sites_location (location),
  CONSTRAINT fk_sites_institution FOREIGN KEY (institution_id) REFERENCES institutions(id),
  CONSTRAINT fk_sites_district FOREIGN KEY (district_id) REFERENCES districts(id)
) ENGINE=InnoDB;
-- statement
CREATE TABLE site_coverage_zones (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  site_id CHAR(36) NOT NULL,
  name VARCHAR(200) NOT NULL,
  area MULTIPOLYGON NOT NULL SRID 4326,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_site_coverage_zones_site_active (site_id, active),
  SPATIAL KEY idx_site_coverage_zones_area (area),
  CONSTRAINT fk_site_coverage_zones_site FOREIGN KEY (site_id) REFERENCES sites(id)
) ENGINE=InnoDB;
-- statement
CREATE TABLE institution_memberships (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id CHAR(36) NOT NULL,
  institution_id CHAR(36) NOT NULL,
  site_id CHAR(36) NULL,
  role_id BIGINT UNSIGNED NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_institution_memberships_scope (user_id, institution_id, site_id, role_id),
  KEY idx_institution_memberships_institution (institution_id, active),
  KEY idx_institution_memberships_site (site_id),
  KEY idx_institution_memberships_role (role_id),
  CONSTRAINT fk_institution_memberships_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_institution_memberships_institution FOREIGN KEY (institution_id) REFERENCES institutions(id),
  CONSTRAINT fk_institution_memberships_site FOREIGN KEY (site_id) REFERENCES sites(id),
  CONSTRAINT fk_institution_memberships_role FOREIGN KEY (role_id) REFERENCES roles(id)
) ENGINE=InnoDB;
