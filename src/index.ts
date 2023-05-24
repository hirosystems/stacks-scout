import { waitForBtcRestResponsive } from './bitcoin-net';
import { startControlPlaneServer } from './server/p2p-control-plane-server';
import { StacksPeer } from './peer-handler';
import { setupShutdownHandler } from './shutdown';
import { getDefaultStacksNodePeerAddress } from './stacks-p2p';
import { waitForRpcResponsive } from './stacks-rpc';
import { logger, timeout } from './util';
import { startDataPlaneServer } from './server/p2p-data-plane-server';
import {
  StacksPeerMetrics,
  startPrometheusServer,
} from './server/prometheus-server';

async function init() {
  setupShutdownHandler();

  await waitForRpcResponsive();
  await waitForBtcRestResponsive();

  await startDataPlaneServer();
  await startControlPlaneServer();
  await startPrometheusServer();

  await timeout(5000);
  const defaultStacksPeerAddr = getDefaultStacksNodePeerAddress();
  const metrics = new StacksPeerMetrics();
  const stacksPeer = await StacksPeer.connectOutbound(
    defaultStacksPeerAddr,
    metrics
  );
}

init().catch((error) => {
  logger.error(error, 'Init failed: ${error}');
  process.exit(1);
});
