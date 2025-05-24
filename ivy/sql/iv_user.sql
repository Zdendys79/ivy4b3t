SELECT *
FROM fb_users AS u
WHERE
    host LIKE ?
    AND COALESCE(next_worktime, NOW()) <= NOW()
ORDER BY
    COALESCE(next_worktime, NOW() - INTERVAL 2 DAY) ASC
LIMIT 1
