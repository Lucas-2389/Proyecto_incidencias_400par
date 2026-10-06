-- migration 006: persistent rate limiting counters
-- statement
CREATE TABLE rate_limit_counters (
  action VARCHAR(40) NOT NULL,
  bucket_hash CHAR(64) NOT NULL,
  window_start BIGINT UNSIGNED NOT NULL,
  hits INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (action, bucket_hash, window_start),
  KEY idx_rate_limit_counters_window (window_start)
) ENGINE=InnoDB;
