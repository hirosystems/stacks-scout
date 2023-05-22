import { getBitcoinChainInfo, waitForBtcRestResponsive } from './bitcoin-net';
import { startControlPlanServer } from './p2p-control-plane-server';
import { startDataPlanServer } from './p2p-data-plane-server';
import { PeerAddress, StacksPeer } from './peer-handler';
import { setupShutdownHandler } from './shutdown';
import { getDefaultStacksNodePeerAddress } from './stacks-p2p';
import { waitForRpcResponsive } from './stacks-rpc';
import { logger } from './util';

async function init() {
  setupShutdownHandler();

  await waitForRpcResponsive();
  await waitForBtcRestResponsive();

  await startDataPlanServer();
  await startControlPlanServer();

  /*
  getBitcoinChainInfo()
    .then((info) => {
      logger.info(info);
    })
    .catch((err) => {
      logger.error(err);
    });
  */

  const defaultStacksPeerAddr = getDefaultStacksNodePeerAddress();
  const stacksPeer = await StacksPeer.connectOutbound(defaultStacksPeerAddr);
}

init().catch((error) => {
  logger.error(error, 'Init failed: ${error}');
  process.exit(1);
});
