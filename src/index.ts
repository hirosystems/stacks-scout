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

  await startDataPlaneServer();
  await startControlPlaneServer();
  await startPrometheusServer();

  const peerConnections = PeerConnectionMonitor.instance;
  const metrics = StacksPeerMetrics.instance;
  setupPeerInfoLogging(peerConnections, metrics);

  peerConnections.startPeriodicReconnecting();
  peerConnections.startPeerNeighborScanning();

  const defaultPeerEndpoint = await getDefaultStacksNodePeerAddress();
  peerConnections.registerPeerEndpoint(defaultPeerEndpoint);
  peerConnections.loadPeersFromStorage();
}

init().catch((error) => {
  logger.error(error, 'Init failed: ${error}');
  process.exit(1);
});
