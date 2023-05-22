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
  CONTROL_PLANE_HOST: Type.String({ default: '0.0.0.0' }),
  CONTROL_PLANE_PORT: Type.Number({ default: 3000 }),
  BITCOIND_HOST: Type.String({ default: 'localhost' }),
  BITCOIND_PORT: Type.Number({ default: 18443 }),
  STACKS_NODE_RPC_HOST: Type.String({ default: 'localhost' }),
  STACKS_NODE_RPC_PORT: Type.Number({ default: 20443 }),
  STACKS_NODE_P2P_HOST: Type.String({ default: 'localhost' }),
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

export function add(a: number, b: number) {
  const result = a + b;
  logger.info(`Add result: ${result}`);
  return result;
}
