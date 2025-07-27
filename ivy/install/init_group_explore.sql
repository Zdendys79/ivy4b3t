-- =====================================================
-- Inicializace group_explore akce pro všechny uživatele
-- Spustit po vytvoření action_definitions záznamu
-- =====================================================

-- Přidání group_explore akce do user_action_plan pro všechny existující uživatele
INSERT IGNORE INTO user_action_plan (user_id, action_code, next_time)
SELECT id, 'group_explore', NULL
FROM fb_users
WHERE locked IS NULL;

-- Ověření instalace
SELECT 
  COUNT(*) as users_with_group_explore,
  (SELECT COUNT(*) FROM fb_users WHERE locked IS NULL) as total_active_users
FROM user_action_plan 
WHERE action_code = 'group_explore';