#!/bin/bash

echo "Kopíruji všechna data z ivy do ivy_test (kromě action_log a user_action_plan)..."

mysqldump -h $DB_HOST -u $DB_USER -p$DB_PASS ivy \
  c_districts c_portals c_regions debug_incidents fb_groups fb_users \
  heartbeat log_system quotes referers rss_channels rss_urls scheme \
  ui_commands user_behavioral_profiles user_group_limits user_groups \
  | mysql -h $DB_HOST -u $DB_USER -p$DB_PASS ivy_test

echo "Data zkopírována!"