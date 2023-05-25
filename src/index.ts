import { RegtestBitcoinNet } from './bitcoin-net';
import { startControlPlaneServer } from './server/p2p-control-plane-server';
import { StacksPeer } from './peer-handler';
import { setupShutdownHandler } from './shutdown';
import { getDefaultStacksNodePeerAddress } from './stacks-p2p';
import { waitForRpcResponsive } from './stacks-rpc';
import { ENV, logger, timeout } from './util';
import { startDataPlaneServer } from './server/p2p-data-plane-server';
import {
  StacksPeerMetrics,
  startPrometheusServer,
} from './server/prometheus-server';
import { PeerConnectionMonitor } from './peer-connection-monitor';
import { setupPeerInfoLogging } from './peer-logging';

async function init() {
  setupShutdownHandler();

  if (ENV.STACKS_NETWORK_NAME === 'regtest') {
    await waitForRpcResponsive();
    await RegtestBitcoinNet.instance.waitForBtcRestResponsive();
  }

  const metrics = StacksPeerMetrics.instance;
  await startDataPlaneServer(metrics);
  await startControlPlaneServer(metrics);
  await startPrometheusServer();

  const peerConnections = PeerConnectionMonitor.instance;
  setupPeerInfoLogging(peerConnections);

  peerConnections.startPeriodicReconnecting();
  peerConnections.startPeerNeighborScanning();
  peerConnections.registerPeerEndpoint(getDefaultStacksNodePeerAddress());
  peerConnections.loadPeersFromStorage();
}

init().catch((error) => {
  logger.error(error, 'Init failed: ${error}');
  process.exit(1);
});
