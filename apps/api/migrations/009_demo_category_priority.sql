-- migration 009: initialize priority for existing DEMO reference categories
-- statement
UPDATE incident_categories
SET default_priority = 'high'
WHERE is_demo = TRUE
  AND code IN ('fire', 'medical_emergency', 'violence', 'aggression')
  AND default_priority = 'normal';
