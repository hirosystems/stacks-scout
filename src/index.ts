import { getBitcoinChainInfo } from './bitcoin-net';
import { startControlPlanServer } from './control-plane-server';
import { logger } from './util';

startControlPlanServer().catch((err) => {
  logger.error(err);
});

getBitcoinChainInfo()
  .then((info) => {
    logger.info(info);
  })
  .catch((err) => {
    logger.error(err);
  });
