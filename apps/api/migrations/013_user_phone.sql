-- migration 013: optional account contact phone
-- statement
ALTER TABLE users ADD COLUMN phone VARCHAR(20) NULL DEFAULT NULL;
