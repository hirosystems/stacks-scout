import { logger } from './util';

const shutdownSignals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

export function setupShutdownHandler() {
  shutdownSignals.forEach((signal) => {
    process.on(signal, (signal) => {
      logger.info(`received ${signal}, starting shutdown...`);
      // Here you can add any cleanup you want to perform during shutdown
      try {
        logger.error(`Shutdown due to ${signal}`);
        process.exit(0);
      } catch (error) {
        logger.error(error, `Error during shutdown ${error}`);
        process.exit(1);
      }
    });
  });

  process.on('uncaughtException', (error: Error) => {
    logger.error(error, `Uncaught exception ${error}`);
    // No shutdown here, just logging
  });

  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error(`Unhandled Rejection, reason: ${reason}, at: ${promise}`);
    // No shutdown here, just logging
  });
}
