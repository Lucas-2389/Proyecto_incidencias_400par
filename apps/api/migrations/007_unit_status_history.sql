-- migration 007: durable unit status changes
-- statement
CREATE TABLE unit_status_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  unit_id CHAR(36) NOT NULL,
  actor_user_id CHAR(36) NOT NULL,
  previous_status VARCHAR(30) NOT NULL,
  new_status VARCHAR(30) NOT NULL,
  note VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_unit_status_history_unit_time (unit_id, created_at),
  CONSTRAINT fk_unit_status_history_unit FOREIGN KEY (unit_id) REFERENCES units(id),
  CONSTRAINT fk_unit_status_history_actor FOREIGN KEY (actor_user_id) REFERENCES users(id),
  CONSTRAINT chk_unit_status_history_transition CHECK (previous_status <> new_status)
) ENGINE=InnoDB;
