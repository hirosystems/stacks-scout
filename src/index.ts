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
import { PeerConnectionMonitor } from './peer-connection-monitor';

async function init() {
  setupShutdownHandler();

  await waitForRpcResponsive();
  await waitForBtcRestResponsive();

  const metrics = StacksPeerMetrics.instance;
  await startDataPlaneServer(metrics);
  await startControlPlaneServer(metrics);
  await startPrometheusServer();

  await timeout(5000);
  const defaultStacksPeerAddr = getDefaultStacksNodePeerAddress();
  const peerConnections = PeerConnectionMonitor.instance;
  peerConnections.startPeriodicReconnecting();
  peerConnections.startPeerNeighborScanning();
  peerConnections.registerPeerEndpoint(defaultStacksPeerAddr);
}

init().catch((error) => {
  logger.error(error, 'Init failed: ${error}');
  process.exit(1);
});
