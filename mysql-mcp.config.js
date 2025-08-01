module.exports = {
  apps: [{
    name: 'mysql-mcp-server',
    script: 'mysql-mcp-server',
    env: {
      MYSQL_HOST: 'localhost',
      MYSQL_PORT: '3306',
      MYSQL_USER: 'claude',
      MYSQL_PASSWORD: 'hL3xKKLlfP5naMprzTfSR2vh2G3j5wPTQfbMQgJx',
      MYSQL_DATABASE: 'ivy_test'
    },
    restart_delay: 5000,
    max_restarts: 10,
    error_file: '~/.pm2/logs/mysql-mcp-error.log',
    out_file: '~/.pm2/logs/mysql-mcp-out.log'
  }]
};
