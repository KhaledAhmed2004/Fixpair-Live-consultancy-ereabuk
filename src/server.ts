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
  try {
    if (!config.database_url) {
      throw new Error(
        'DATABASE_URL is not configured in .env! Please check your environment variables.',
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

    const port =
      typeof config.port === 'number'
        ? config.port
        : Number(config.port) || 5000;
    const ip = config.ip_address || '0.0.0.0';

    server = app.listen(port, ip, () => {
      logger.info(
        colors.yellow(`♻️  Application listening on port:${port} (host: ${ip})`),
      );
    });

    //socket
    const io = new Server(server, {
      pingTimeout: 60000,
      cors: corsOptions,
    });
    socketHelper.socket(io);
    //@ts-ignore
    global.io = io;
  } catch (error: any) {
    errorLogger.error(
      colors.red('🤢 Failed to connect Database:'),
      error?.message || error,
    );
    if (error?.name === 'MongooseServerSelectionError') {
      errorLogger.error(
        colors.yellow(
          '👉 TIP: MongoDB Atlas connection timed out (30s). Please ensure your EC2 IP is whitelisted in MongoDB Atlas Network Access (or set 0.0.0.0/0).',
        ),
      );
    }
    process.exit(1);
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
