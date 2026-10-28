/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import colors from 'colors';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import app from './app';
import config from './config';
import { corsOptions } from './config/cors';
import { seedSuperAdmin } from './DB/seedAdmin';
import { socketHelper } from './helpers/socketHelper';
import { errorLogger, logger } from './shared/logger';
import process from 'process';
import cronJobs from './app/cron';
import { BillingService } from './app/modules/payment/billing.service';

//uncaught exception
process.on('uncaughtException', error => {
  errorLogger.error('UnhandleException Detected', error);
  process.exit(1);
});

let server: any;
async function main() {
  const port =
    typeof config.port === 'number'
      ? config.port
      : Number(config.port) || 5000;
  const ip = config.ip_address || '0.0.0.0';

  // 1. Immediately start HTTP Server so port 5000 is open,
  // health checks pass, Nginx proxy functions, and CORS preflights are handled.
  server = app.listen(port, ip, () => {
    logger.info(
      colors.yellow(`♻️  Application listening on port:${port} (host: ${ip})`),
    );
  });

  // 2. Initialize Socket.IO
  const io = new Server(server, {
    pingTimeout: 60000,
    cors: corsOptions,
  });
  socketHelper.socket(io);
  //@ts-ignore
  global.io = io;

  // 3. Connect to Database asynchronously without blocking the web listener
  try {
    if (!config.database_url) {
      throw new Error(
        'DATABASE_URL is not configured in .env! Please check your environment variables.',
      );
    }

    if (config.database_url.includes('<username>')) {
      throw new Error(
        'DATABASE_URL still contains placeholder "<username>" from .env.example! Please update your .env or GitHub Secret ENV_FILE.',
      );
    }

    logger.info(colors.cyan('Connecting to MongoDB database...'));
    await mongoose.connect(config.database_url as string);
    logger.info(colors.green('🚀 Database connected successfully'));

    //Seed Super Admin after database connection is successful
    await seedSuperAdmin();

    // Initialize cron jobs
    cronJobs();

    // Recover billing sessions after restart
    await BillingService.recoverBilling();
  } catch (error: any) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    errorLogger.error(colors.red(`🤢 Failed to connect Database: ${errorMsg}`));
    console.error('DATABASE_CONNECTION_ERROR:', error);
    if (error?.name === 'MongooseServerSelectionError') {
      errorLogger.error(
        colors.yellow(
          '👉 TIP: MongoDB Atlas connection timed out (30s). Please ensure your EC2 IP is whitelisted in MongoDB Atlas Network Access (or set 0.0.0.0/0).',
        ),
      );
    }
  }

  //handle unhandleRejection
  process.on('unhandledRejection', error => {
    if (server) {
      server.close(() => {
        errorLogger.error('UnhandleRejection Detected', error);
        process.exit(1);
      });
    } else {
      process.exit(1);
    }
  });
}

main();

//SIGTERM
process.on('SIGTERM', () => {
  logger.info('SIGTERM IS RECEIVE');
  if (server) {
    server.close();
  }
});
