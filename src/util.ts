import * as crypto from 'node:crypto';
import { pino, LevelWithSilent as PinoLogLevel } from 'pino';
import { envSchema } from 'env-schema';
import { Static, Type } from '@sinclair/typebox';
import * as secp256k1 from 'secp256k1';

export const LogLevel: { [K in PinoLogLevel]: K } = {
  fatal: 'fatal',
  error: 'error',
  warn: 'warn',
  info: 'info',
  debug: 'debug',
  trace: 'trace',
  silent: 'silent',
} as const;

const NodeEnv = {
  production: 'production',
  development: 'development',
  test: 'test',
} as const;

const schema = Type.Object({
  NODE_ENV: Type.Enum(NodeEnv),
  LOG_LEVEL: Type.Enum(LogLevel, { default: 'debug' }),

  DATA_STORAGE_DIR: Type.String({ default: './state' }),

  /** AKA RPC interface */
  DATA_PLANE_HOST: Type.String({ default: '0.0.0.0' }),
  DATA_PLANE_PORT: Type.Number({ default: 30443 }),

  /** AKA p2p socket */
  CONTROL_PLANE_HOST: Type.String({ default: '0.0.0.0' }),
  CONTROL_PLANE_PORT: Type.Number({ default: 30444 }),

  PROMETHEUS_HOST: Type.String({ default: '0.0.0.0' }),
  PROMETHEUS_PORT: Type.Number({ default: 9153 }),

  DATA_PLANE_PUBLIC_HOST: Type.Union(
    [
      Type.Literal('auto', {
        description:
          'Automatically determine the public IP address of this node',
      }),
      Type.String(),
    ],
    {
      default: 'auto',
      description:
        'Publicly routable host to the data plane server, should correspond to the DATA_PLANE_HOST config. Use `auto` to automatically determine the public IP address of this node.',
    }
  ),

  DATA_PLANE_PUBLIC_PORT: Type.Number({
    default: 30443,
    description:
      'Publicly routable port to the data plane server, should correspond to the DATA_PLANE_PORT config.',
  }),

  CONTROL_PLANE_PUBLIC_HOST: Type.Union(
    [
      Type.Literal('auto', {
        description:
          'Automatically determine the public IP address of this node',
      }),
      Type.String(),
    ],
    {
      default: 'auto',
      description:
        'Publicly routable host to the control plane server, should correspond to the CONTROL_PLANE_HOST config. Use `auto` to automatically determine the public IP address of this node.',
    }
  ),

  CONTROL_PLANE_PUBLIC_PORT: Type.Number({
    default: 30444,
    description:
      'Publicly routable port to the control plane server, should correspond to the CONTROL_PLANE_PORT config.',
  }),

  PEER_PRIVATE_KEY: Type.String({
    default: '8c45db8322f3f8e36389bc4e6091e82060ed2d0db7d8ac6858cc3e90a6639715',
    description: 'The key this peer uses for message signing.',
  }),
  PEER_NEIGHBOR_SCAN_INTERVAL_MS: Type.Number({ default: 1000 * 30 }),
  PEER_RECONNECT_INTERVAL_MS: Type.Number({ default: 1000 * 60 * 1 }),
  PEER_REPORT_INTERVAL_MS: Type.Number({ default: 1000 * 30 }),

  BITCOIND_HOST: Type.String({ default: '127.0.0.1' }),
  BITCOIND_PORT: Type.Number({ default: 18443 }),

  STACKS_NODE_RPC_HOST: Type.String({ default: '127.0.0.1' }),
  STACKS_NODE_RPC_PORT: Type.Number({ default: 20443 }),

  STACKS_NODE_P2P_HOST: Type.String({ default: '127.0.0.1' }),
  STACKS_NODE_P2P_PORT: Type.Number({ default: 20444 }),

  STACKS_NODE_P2P_BOOTSTRAPS: Type.Optional(
    Type.String({
      description:
        'Endpoints in the form of `host:port` separated by commas. Used for bootstrapping initial peer connections',
    })
  ),

  STACKS_NETWORK_NAME: Type.Union([
    Type.Literal('mainnet'),
    Type.Literal('testnet'),
    Type.Literal('regtest'),
  ]),
});

export const ENV = envSchema<Static<typeof schema>>({
  dotenv: true,
  schema,
});

export const loggerOpts: pino.LoggerOptions = {
  level: ENV.LOG_LEVEL,
};
if (ENV.NODE_ENV !== 'production') {
  loggerOpts.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  };
}
export const logger = pino(loggerOpts);

export class WeakDictionary<
  TKey extends string | number | symbol,
  TValue extends object
> {
  private _cache = {} as Record<TKey, WeakRef<TValue>>;
  private _finalizer = new FinalizationRegistry((key: TKey) => {
    delete this._cache[key];
  });

  get(key: TKey): TValue | undefined {
    return this._cache[key]?.deref();
  }

  set(key: TKey, value: TValue): void {
    const existing = this.get(key);
    if (existing !== undefined) {
      if (existing === value) {
        return;
      }
      throw new Error(
        `Key "${String(key)}" already registered with a different object`
      );
    }
    this._cache[key] = new WeakRef(value);
    this._finalizer.register(value, key, value);
  }
}

export function timeout(ms: number, abort?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    abort?.throwIfAborted();
    let isResolved = false;
    const timeoutInstance = setTimeout(() => {
      isResolved = true;
      resolve();
      abort?.removeEventListener('abort', onAbort);
    }, ms);
    const onAbort = () => {
      clearTimeout(timeoutInstance);
      if (!isResolved) {
        reject(abort?.reason ?? new Error('Aborted'));
      }
    };
    abort?.addEventListener('abort', onAbort, { once: true });
  });
}

export const INT = {
  MAX_U8: 2 ** 8 - 1,
  MAX_U16: 2 ** 16 - 1,
  MAX_U32: 2 ** 32 - 1,
  MAX_U64: 2n ** 64n - 1n,
  MAX_I8: 2 ** 7 - 1,
  MAX_I16: 2 ** 15 - 1,
  MAX_I32: 2 ** 31 - 1,
  MAX_I64: 2n ** 63n - 1n,
  MIN_I8: -(2 ** 7),
  MIN_I16: -(2 ** 15),
  MIN_I32: -(2 ** 31),
  MIN_I64: -(2n ** 63n),
} as const;

/** Create RIPEMD160 digest */
export function hash160(data: Uint8Array): Buffer {
  // digest algo names reported by openssl: ripemd, rmd160, RIPEMD160
  const hasher = crypto.createHash('ripemd160');
  const result = hasher.update(data).digest();
  return result;
}

const _lastPublicIP = { ip: Promise.resolve('127.0.0.1'), date: 0 };
export async function getPublicIP(): Promise<string> {
  // Cache IP for 10 minutes
  if (_lastPublicIP.date > Date.now() - 10 * 60 * 1000) {
    return _lastPublicIP.ip;
  }
  // Use last IP if fetching a new one fails
  const lastIP = _lastPublicIP.ip;
  const myIPPromise = import('public-ip') // need to dynamic import this ESM module
    .then((res) => {
      return res.publicIpv4({ onlyHttps: true });
    })
    .catch((error) => {
      logger.error(error, 'Failed to fetch public IP');
      return lastIP;
    });
  _lastPublicIP.ip = myIPPromise;
  _lastPublicIP.date = Date.now();
  return await myIPPromise;
}

let _peerKeyPair:
  | {
      privKey: Buffer;
      pubKey: Buffer;
      pubKeyHash: Buffer;
    }
  | undefined;
export function getPeerKeyPair() {
  if (_peerKeyPair === undefined) {
    const privKey = Buffer.from(ENV.PEER_PRIVATE_KEY, 'hex');
    const pubKey = Buffer.from(secp256k1.publicKeyCreate(privKey));
    const pubKeyHash = hash160(pubKey);
    _peerKeyPair = { privKey, pubKey, pubKeyHash };
  }
  return _peerKeyPair;
}
