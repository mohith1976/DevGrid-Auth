/**
 * Configuration Management
 * 
 * Handles environment-based configuration with validation.
 * All configuration is loaded at startup and validated before service starts.
 * Fail fast on invalid or missing configuration.
 */

interface AppConfig {
  port: number;
  nodeEnv: 'development' | 'staging' | 'production';
  github: {
    clientId: string;
    clientSecret: string;
  };
  service: {
    url: string;
  };
  session: {
    secret: string;
  };
  extension: {
    callbackUrl: string;
  };
}

function validateRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function validatePort(portStr: string): number {
  const port = parseInt(portStr, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT: must be a number between 1 and 65535, got ${portStr}`);
  }
  return port;
}

function validateNodeEnv(env: string): 'development' | 'staging' | 'production' {
  const validEnvs = ['development', 'staging', 'production'];
  if (!validEnvs.includes(env)) {
    throw new Error(
      `Invalid NODE_ENV: must be one of ${validEnvs.join(', ')}, got ${env}`
    );
  }
  return env as 'development' | 'staging' | 'production';
}

/**
 * Load and validate configuration from environment variables
 * Throws error if configuration is invalid or incomplete
 */
export function loadConfig(): AppConfig {
  // Required variables
  const nodeEnvStr = validateRequiredEnv('NODE_ENV');
  const portStr = validateRequiredEnv('PORT');
  const githubClientId = validateRequiredEnv('GITHUB_CLIENT_ID');
  const githubClientSecret = validateRequiredEnv('GITHUB_CLIENT_SECRET');
  const authServiceUrl = validateRequiredEnv('AUTH_SERVICE_URL');
  const sessionSecret = validateRequiredEnv('SESSION_SECRET');
  const extensionCallbackUrl = validateRequiredEnv('EXTENSION_CALLBACK_URL');

  // Validate port
  const port = validatePort(portStr);

  // Validate environment
  const nodeEnv = validateNodeEnv(nodeEnvStr);

  const config: AppConfig = {
    port,
    nodeEnv,
    github: {
      clientId: githubClientId,
      clientSecret: githubClientSecret,
    },
    service: {
      url: authServiceUrl,
    },
    session: {
      secret: sessionSecret,
    },
    extension: {
      callbackUrl: extensionCallbackUrl,
    },
  };

  return config;
}

// Lazy-load configuration - will be populated at startup
let cachedConfig: AppConfig | null = null;

/**
 * Get cached configuration
 * Must be called after loadConfig() has been executed
 */
export function getConfig(): AppConfig {
  if (!cachedConfig) {
    throw new Error('Configuration not loaded. Call loadConfig() at startup.');
  }
  return cachedConfig;
}

/**
 * Initialize configuration - called once at startup
 */
export function initializeConfig(): AppConfig {
  cachedConfig = loadConfig();
  return cachedConfig;
}
