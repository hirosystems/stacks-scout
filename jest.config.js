/* eslint-disable */
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  verbose: true,
  cache: false,
};

process.env.STACKS_NETWORK_NAME = 'regtest';
process.env.DATA_PLANE_PUBLIC_HOST='127.0.0.1';
process.env.CONTROL_PLANE_PUBLIC_HOST='127.0.0.1';
