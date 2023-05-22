import {
  getBtcBlockByHeight,
  getBtcBlockHashByHeight,
  getBtcChainInfo,
  waitForBtcRestResponsive,
} from './bitcoin-net';
import { startControlPlanServer } from './p2p-control-plane-server';
import { startDataPlanServer } from './p2p-data-plane-server';
import { PeerEndpoint, StacksPeer } from './peer-handler';
import { setupShutdownHandler } from './shutdown';
import { getDefaultStacksNodePeerAddress } from './stacks-p2p';
import { waitForRpcResponsive } from './stacks-rpc';
import { logger, timeout } from './util';

async function init() {
  setupShutdownHandler();

  await waitForRpcResponsive();
  await waitForBtcRestResponsive();

  await startDataPlanServer();
  await startControlPlanServer();

  /*
  getBtcChainInfo()
    .then((info) => {
      logger.info(info);
    })
    .catch((err) => {
      logger.error(err);
    });
  getBtcBlockByHeight(7)
    .then((info) => {
      logger.info(info);
    })
    .catch((err) => {
      logger.error(err);
    });
  */

  await timeout(5000);
  const defaultStacksPeerAddr = getDefaultStacksNodePeerAddress();
  const stacksPeer = await StacksPeer.connectOutbound(defaultStacksPeerAddr);
}

init().catch((error) => {
  logger.error(error, 'Init failed: ${error}');
  process.exit(1);
});
