-- migration 010: optional FCM device registration
-- statement
CREATE TABLE push_device_tokens (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  token TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_push_token_hash (token_hash),
  KEY idx_push_devices_user_active (user_id, active),
  CONSTRAINT fk_push_devices_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;
