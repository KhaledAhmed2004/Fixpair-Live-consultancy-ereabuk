module.exports = {
  apps: [
    {
      name: 'fixpair-backend',
      script: './dist/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        IP_ADDRESS: '0.0.0.0',
      },
    },
  ],
};
