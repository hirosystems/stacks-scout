import * as path from 'node:path';
import sqlite3 from 'better-sqlite3';
import { PeerEndpoint } from './peer-endpoint';
import { ENV } from './util';

export class PeerState {
  endpoint: PeerEndpoint;
  lastMessageReceivedAt = 0;
  lastPongReceivedAt = 0;
  lastPingSentAt = 0;
  lastBurnBlockHeight = 0;
  lastBurnBlockHash = '';

  constructor(endpoint: PeerEndpoint) {
    this.endpoint = endpoint;
  }

  static fromString(endpoint: PeerEndpoint, str: string) {
    const peer = new PeerState(endpoint);
    Object.assign(peer, JSON.parse(str));
    return peer;
  }

  toString() {
    const { endpoint, ...rest } = this;
    return JSON.stringify(rest);
  }
}

export class PeerStorage {
  private readonly TABLE = {
    peer_state: 'peer_state',
    peer_stats: 'peer_stats',
  } as const;

  private readonly db: sqlite3.Database;

  private constructor(filePath: string) {
    this.db = new sqlite3(filePath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS ${this.TABLE.peer_state} (key TEXT PRIMARY KEY, value TEXT)`
    );
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS ${this.TABLE.peer_stats} (key TEXT PRIMARY KEY, value TEXT)`
    );
  }

  static _openInstances = new Map<string, PeerStorage>();
  static open(): PeerStorage {
    const fileName = 'peer-storage.sqlite';
    const filePath = path.join(ENV.DATA_STORAGE_DIR, fileName);
    let storage = this._openInstances.get(filePath);
    if (storage === undefined) {
      storage = new PeerStorage(filePath);
      this._openInstances.set(filePath, storage);
    }
    return storage;
  }

  getPeerState(endpoint: PeerEndpoint): PeerState | undefined {
    // read from peer_state, return undefined if not found
    const row = this.db
      .prepare(`SELECT value FROM ${this.TABLE.peer_state} WHERE key = ?`)
      .get(endpoint.toString()) as string | undefined;
    if (row === undefined) {
      return undefined;
    }
    return PeerState.fromString(endpoint, row);
  }

  setPeerState(peer: PeerState) {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO ${this.TABLE.peer_state} (key, value) VALUES (?, ?)`
      )
      .run(peer.endpoint.toString(), peer.toString());
  }

  hasPeer(endpoint: PeerEndpoint) {
    // check if key exists in peer_state
    const row = this.db
      .prepare(
        `SELECT EXISTS(SELECT 1 FROM ${this.TABLE.peer_state} WHERE key = ?)`
      )
      .get(endpoint.toString()) as boolean;
    if (typeof row !== 'boolean') {
      throw new Error('Unexpected result from EXISTS query');
    }
    return row;
  }
}
