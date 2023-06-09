import Fastify from 'fastify';
import { ENV, logger } from '../util';
import FastifyMetrics from 'fastify-metrics';
import * as prom from 'prom-client';

export class StacksPeerMetrics {
  /** Number of Stacks nodes discovered on the configured network */
  readonly stacks_scout_discovered_nodes: prom.Gauge;
  /** Number of Stacks node miners discovered on the configured network */
  readonly stacks_scout_discovered_miners: prom.Gauge;
  /** Number of connected peers */
  readonly stacks_scout_connected_peers: prom.Gauge;
  /** Rate at which blocks propagate across the configured network */
  readonly stacks_scout_block_propagation_rate_bucket: prom.Histogram;
  /** Rate at which microblocks propagate across the configured network */
  readonly stacks_scout_microblock_propagation_rate_bucket: prom.Histogram;
  /** Rate at which mempool transactions propagate across the configured network */
  readonly stacks_scout_mempool_propagation_rate_bucket: prom.Histogram;
  /** Rate at which mempool transactions are being included in mined blocks for configured network */
  readonly stacks_scout_mempool_inclusion_rate_bucket: prom.Histogram;
  /** Peer Stacks node versions */
  readonly stacks_scout_version: prom.Gauge;
  /** Stacks node latency in milliseconds */
  readonly stacks_scout_node_request_duration_milliseconds_bucket: prom.Histogram;

  private static _instance: StacksPeerMetrics | undefined;
  static get instance(): StacksPeerMetrics {
    if (this._instance === undefined) {
      this._instance = new StacksPeerMetrics();
    }
    return this._instance;
  }

  private constructor() {
    this.stacks_scout_discovered_nodes = new prom.Gauge({
      name: 'stacks_scout_discovered_nodes',
      help: 'Number of Stacks nodes discovered on the configured network',
    });
    this.stacks_scout_discovered_miners = new prom.Gauge({
      name: 'stacks_scout_discovered_miners',
      help: 'Number of Stacks node miners discovered on the configured network',
    });
    this.stacks_scout_connected_peers = new prom.Gauge({
      name: 'stacks_scout_connected_peers',
      help: 'Number of connected peers',
      labelNames: ['direction'],
    });
    this.stacks_scout_block_propagation_rate_bucket = new prom.Histogram({
      name: 'stacks_scout_block_propagation_rate_bucket',
      help: 'Rate at which blocks propagate across the configured network',
      buckets: prom.exponentialBuckets(100, 2, 10),
    });
    this.stacks_scout_microblock_propagation_rate_bucket = new prom.Histogram({
      name: 'stacks_scout_microblock_propagation_rate_bucket',
      help: 'Rate at which microblocks propagate across the configured network',
      buckets: prom.exponentialBuckets(100, 2, 10),
    });
    this.stacks_scout_mempool_propagation_rate_bucket = new prom.Histogram({
      name: 'stacks_scout_mempool_propagation_rate_bucket',
      help: 'Rate at which mempool transactions propagate across the configured network',
      buckets: prom.exponentialBuckets(100, 2, 10),
    });
    this.stacks_scout_mempool_inclusion_rate_bucket = new prom.Histogram({
      name: 'stacks_scout_mempool_inclusion_rate_bucket',
      help: 'Rate at which mempool transactions are being included in mined blocks for configured network',
      buckets: [0.1, 0.25, 0.5, 0.75, 0.9, 1.0],
    });
    this.stacks_scout_version = new prom.Gauge({
      name: 'stacks_scout_version',
      help: 'Peer Stacks node versions',
      labelNames: ['version'],
    });
    this.stacks_scout_node_request_duration_milliseconds_bucket =
      new prom.Histogram({
        name: 'stacks_scout_node_request_duration_milliseconds_bucket',
        help: 'Stacks node latency in milliseconds',
        buckets: prom.exponentialBuckets(10, 2, 10),
        labelNames: ['message'],
      });
  }
}

export async function startPrometheusServer() {
  const promServer = Fastify({ logger });

  await promServer.register(FastifyMetrics, {
    routeMetrics: { enabled: false },
  });

  const addr = await promServer.listen({
    host: ENV.PROMETHEUS_HOST,
    port: ENV.PROMETHEUS_PORT,
  });
  logger.info(`Prometheus server running at ${addr}`);

  return promServer;
}
