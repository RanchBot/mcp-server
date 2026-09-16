import axios from 'axios';
import {
  ADMIN_MODE,
  COGNITO_DEVICE_CLIENT_ID,
  DEVICE_CODE_ENDPOINT,
  DEVICE_TOKEN_ENDPOINT,
  RANCHBOT_API_URL,
} from './config';

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}

export interface OAuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

const requireClientId = (): string => {
  if (!COGNITO_DEVICE_CLIENT_ID) {
    throw new Error(
      'No OAuth client id configured. Set the COGNITO_DEVICE_CLIENT_ID environment variable (see the README).',
    );
  }
  return COGNITO_DEVICE_CLIENT_ID;
};

/**
 * Initiate device authorization flow
 */
export const initiateDeviceFlow = async (): Promise<DeviceCodeResponse> => {
  try {
    const response = await axios.post(DEVICE_CODE_ENDPOINT, {
      client_id: requireClientId(),
      scope:
        'read:farms read:animals write:animals read:records write:records read:groups write:groups read:exports' +
        (ADMIN_MODE ? ' admin:imports' : ''),
    });

    return response.data;
  } catch (error: any) {
    throw new Error(
      `Failed to initiate device flow: ${error.response?.data?.message || error.message}`,
    );
  }
};

/**
 * Poll for token after user approves device
 */
export const pollForToken = async (
  deviceCode: string,
  interval: number = 5,
): Promise<OAuthTokens> => {
  const maxAttempts = 60; // 5 minutes max (60 * 5 seconds)
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const response = await axios.post(
        DEVICE_TOKEN_ENDPOINT,
        {
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          device_code: deviceCode,
          client_id: COGNITO_DEVICE_CLIENT_ID,
        },
        {
          validateStatus: (status) => status === 200 || status === 400,
        },
      );

      if (response.status === 200) {
        return {
          access_token: response.data.access_token,
          refresh_token: response.data.refresh_token,
          token_type: response.data.token_type || 'Bearer',
          expires_in: response.data.expires_in || 3600,
          scope: response.data.scope,
        };
      }

      // Check for specific error codes
      if (response.data.error === 'authorization_pending') {
        // Continue polling
        attempts++;
        await new Promise((resolve) => setTimeout(resolve, interval * 1000));
        continue;
      }

      if (response.data.error === 'slow_down') {
        // Increase polling interval
        interval = Math.min(interval * 2, 60);
        attempts++;
        await new Promise((resolve) => setTimeout(resolve, interval * 1000));
        continue;
      }

      if (response.data.error === 'expired_token') {
        throw new Error('Device code expired. Please restart the authorization flow.');
      }

      throw new Error(
        response.data.error_description || response.data.error || 'Authorization failed',
      );
    } catch (error: any) {
      if (
        error.response?.status === 400 &&
        error.response?.data?.error === 'authorization_pending'
      ) {
        // Continue polling
        attempts++;
        await new Promise((resolve) => setTimeout(resolve, interval * 1000));
        continue;
      }
      throw error;
    }
  }

  throw new Error('Authorization timeout. Please try again.');
};

export const revokeRefreshToken = async (refreshToken: string): Promise<void> => {
  await axios.post(`${RANCHBOT_API_URL}/oauth/revoke`, {
    token: refreshToken,
    client_id: requireClientId(),
  });
};

/**
 * Refresh an access token using a refresh token
 */
export const refreshAccessToken = async (refreshToken: string): Promise<OAuthTokens> => {
  try {
    const response = await axios.post(`${RANCHBOT_API_URL}/oauth/token`, {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: requireClientId(),
    });

    return {
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token || refreshToken,
      token_type: response.data.token_type || 'Bearer',
      expires_in: response.data.expires_in || 3600,
      scope: response.data.scope,
    };
  } catch (error: any) {
    throw new Error(`Failed to refresh token: ${error.response?.data?.message || error.message}`);
  }
};
