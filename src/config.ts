import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_DEVICE_CLIENT_ID = 'ranchbot-mcp';
const ADMIN_DEVICE_CLIENT_ID = 'ranchbot-admin-cli';

const getEnvString = (name: string, defaultValue?: string): string => {
  const value = process.env[name];
  if (!value && defaultValue === undefined) {
    throw new Error(`Environment variable ${name} is not set`);
  }
  return value || defaultValue!;
};

export const IS_LOCAL = process.env.RANCHBOT_DEPLOYMENT_MODE === 'local';
export const RANCHBOT_API_URL = getEnvString(
  'RANCHBOT_API_URL',
  IS_LOCAL ? 'http://localhost:8080' : 'https://api.ranch.bot',
);
export const API_VERSION = getEnvString('API_VERSION', 'v1');
export const COGNITO_DEVICE_CLIENT_ID = process.argv.includes('--admin')
  ? ADMIN_DEVICE_CLIENT_ID
  : getEnvString('COGNITO_DEVICE_CLIENT_ID', DEFAULT_DEVICE_CLIENT_ID);
export const ADMIN_MODE = COGNITO_DEVICE_CLIENT_ID === ADMIN_DEVICE_CLIENT_ID;
export const DEVICE_CODE_ENDPOINT = `${RANCHBOT_API_URL}/oauth/device`;
export const TOKEN_ENDPOINT = `${RANCHBOT_API_URL}/oauth/token`;
export const DEVICE_TOKEN_ENDPOINT = `${RANCHBOT_API_URL}/oauth/device/token`;
