export default {
  getGroupTypeLimit: `
    SELECT max_posts
    FROM user_group_limits
    WHERE user_id = ? AND group_type = ?
  `,

  checkCanPost: `
    SELECT
      CASE
        WHEN posts_today < max_posts THEN 1
        ELSE 0
      END as can_post
    FROM user_group_limits
    WHERE user_id = ? AND group_type = ?
  `,

  updatePostCount: `
    UPDATE user_group_limits
    SET posts_today = posts_today + 1
    WHERE user_id = ? AND group_type = ?
  `
};
