# needs: [ user_id, user_id, user_id ]
SELECT
    *
FROM
    `utiolite`.`fb_groups`
WHERE
    `fb_groups`.`priority` > 0
#    AND
#    `fb_groups`.`user_counter` > '150'
# only groups where is not in user lock list 
    AND `fb_groups`.`id` NOT IN (
        SELECT
            `user_groups`.`group_id` AS g
        FROM
            `user_groups`, `fb_groups`
        WHERE
            `user_groups`.`group_id` = `fb_groups`.`id`
#            AND
#            `fb_groups`.`typ` = "G"
            AND
            `user_groups`.`user_id` = ?
            AND
            `user_groups`.`time` > NOW() - INTERVAL 3 DAY
    )
# groups in user<=>regions / owned groups / global groups
    AND (
        `fb_groups`.`typ` LIKE "GV"
        OR `fb_groups`.`region_id` = 0
        OR `fb_groups`.`region_id` IN ( SELECT `region_id` FROM `userregion` WHERE `user_id` = ? )
    )
# groups not served in last day interval by user
    AND `fb_groups`.`id` NOT IN (
        SELECT group_id
        FROM `log`
        WHERE `user_id` = ?
            AND `inserted` > NOW() - INTERVAL 18 HOUR
    )
    AND COALESCE (`fb_groups`.`next_seen`, NOW() - INTERVAL 1 MINUTE) < NOW()
    AND COALESCE (`fb_groups`.`last_seen`, NOW() - INTERVAL 6 MINUTE) < (NOW() - INTERVAL 5 MINUTE)
ORDER BY
    COALESCE (`fb_groups`.`last_seen`, NOW() - INTERVAL 6 MINUTE) ASC
LIMIT
    1