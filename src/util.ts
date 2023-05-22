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

  BITCOIND_HOST: Type.String({ default: '127.0.0.1' }),
  BITCOIND_PORT: Type.Number({ default: 18443 }),

  STACKS_NODE_RPC_HOST: Type.String({ default: '127.0.0.1' }),
  STACKS_NODE_RPC_PORT: Type.Number({ default: 20443 }),

  STACKS_NODE_P2P_HOST: Type.String({ default: '127.0.0.1' }),
  STACKS_NODE_P2P_PORT: Type.Number({ default: 20444 }),
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

export function add(a: number, b: number) {
  const result = a + b;
  logger.info(`Add result: ${result}`);
  return result;
}
