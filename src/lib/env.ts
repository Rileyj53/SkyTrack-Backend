/**
 * Environment variable validation
 * This ensures all required environment variables are present
 */

const requiredEnvVars = [
  'MONGODB_URI',
  'JWT_SECRET',
  'CSRF_SECRET',
  'ENCRYPTION_KEY',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
  'SMTP_FROM',
  'NEXT_PUBLIC_APP_URL',
] as const;

/**
 * Validates that all required environment variables are present
 * @throws Error if any required environment variable is missing
 */
export function validateEnv() {
  const missingVars = requiredEnvVars.filter(
    (envVar) => !process.env[envVar]
  );

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}`
    );
  }
}

// Run validation immediately
validateEnv(); 