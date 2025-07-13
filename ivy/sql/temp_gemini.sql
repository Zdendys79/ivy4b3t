-- Oprava nadměrné chybovosti u existujících behaviorálních profilů
UPDATE user_behavioral_profiles
SET mistake_rate = mistake_rate / 10
WHERE mistake_rate > 0.01;