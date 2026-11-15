-- migration 012: optional observations of the principal affected person
-- statement
DROP PROCEDURE IF EXISTS migrate_012_medical_triage;
-- statement
CREATE PROCEDURE migrate_012_medical_triage()
BEGIN
  DECLARE clinical_columns INT DEFAULT 0;
  DECLARE matching_columns INT DEFAULT 0;
  DECLARE clinical_checks INT DEFAULT 0;
  DECLARE matching_checks INT DEFAULT 0;

  SELECT COUNT(*), COALESCE(SUM(
    COLUMN_TYPE = 'tinyint(1)' AND IS_NULLABLE = 'YES'
    AND COLUMN_DEFAULT IS NULL AND EXTRA = ''), 0)
  INTO clinical_columns, matching_columns
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'incidents'
    AND COLUMN_NAME IN ('is_conscious', 'is_breathing', 'has_bleeding');

  SELECT COUNT(*), COALESCE(SUM(tc.ENFORCED = 'YES' AND
    REGEXP_REPLACE(LOWER(cc.CHECK_CLAUSE), '[`[:space:]()]', '') =
      CONCAT(SUBSTRING(tc.CONSTRAINT_NAME, CHAR_LENGTH('chk_incidents_') + 1), 'in0,1')), 0)
  INTO clinical_checks, matching_checks
  FROM information_schema.TABLE_CONSTRAINTS tc
  JOIN information_schema.CHECK_CONSTRAINTS cc
    ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
  WHERE tc.TABLE_SCHEMA = DATABASE() AND tc.TABLE_NAME = 'incidents'
    AND tc.CONSTRAINT_NAME IN ('chk_incidents_is_conscious', 'chk_incidents_is_breathing', 'chk_incidents_has_bleeding');

  IF clinical_columns = 0 AND clinical_checks = 0 THEN
    ALTER TABLE incidents
      ADD COLUMN is_conscious BOOLEAN NULL DEFAULT NULL,
      ADD COLUMN is_breathing BOOLEAN NULL DEFAULT NULL,
      ADD COLUMN has_bleeding BOOLEAN NULL DEFAULT NULL,
      ADD CONSTRAINT chk_incidents_is_conscious CHECK (is_conscious IN (0, 1)),
      ADD CONSTRAINT chk_incidents_is_breathing CHECK (is_breathing IN (0, 1)),
      ADD CONSTRAINT chk_incidents_has_bleeding CHECK (has_bleeding IN (0, 1));
  ELSEIF clinical_columns <> 3 OR matching_columns <> 3 OR clinical_checks <> 3 OR matching_checks <> 3 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '012_medical_triage: esquema clinico parcial o incompatible';
  END IF;
END;
-- statement
CALL migrate_012_medical_triage();
-- statement
DROP PROCEDURE migrate_012_medical_triage;
