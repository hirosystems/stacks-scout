import { pino, LevelWithSilent as PinoLogLevel } from 'pino';
import { envSchema } from 'env-schema';
import { Static, Type } from '@sinclair/typebox';

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

  /** AKA RPC interface */
  DATA_PLANE_HOST: Type.String({ default: '0.0.0.0' }),
  DATA_PLANE_PORT: Type.Number({ default: 30443 }),

  /** AKA p2p socket */
  CONTROL_PLANE_HOST: Type.String({ default: '0.0.0.0' }),
  CONTROL_PLANE_PORT: Type.Number({ default: 30444 }),

  DATA_PLANE_PUBLIC_URL: Type.String({
    default: 'http://127.0.0.1:30443',
    description:
      'Publicly routable URL to the data plane server, should correspond to the DATA_PLANE_HOST:DATA_PLANE_PORT config.',
  }),

  BITCOIND_HOST: Type.String({ default: '127.0.0.1' }),
  BITCOIND_PORT: Type.Number({ default: 18443 }),

  STACKS_NODE_RPC_HOST: Type.String({ default: '127.0.0.1' }),
  STACKS_NODE_RPC_PORT: Type.Number({ default: 20443 }),

  STACKS_NODE_P2P_HOST: Type.String({ default: '127.0.0.1' }),
  STACKS_NODE_P2P_PORT: Type.Number({ default: 20444 }),

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
