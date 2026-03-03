import fs from 'fs';
import path from 'path';
import { logger } from './logger.js';

const RAILWAY_VOLUME = process.env.RAILWAY_VOLUME_MOUNT_PATH || '/data';
const IS_RAILWAY = !!process.env.RAILWAY_ENVIRONMENT;

/**
 * Resolve the .env file path.
 * On Railway, uses the persistent volume so values survive deploys.
 * Locally, uses the project root.
 */
function envFilePath(): string {
  if (IS_RAILWAY) {
    return path.join(RAILWAY_VOLUME, '.env');
  }
  return path.join(process.cwd(), '.env');
}

/**
 * Parse the .env file and return values for the requested keys.
 * Does NOT load anything into process.env — callers decide what to
 * do with the values. This keeps secrets out of the process environment
 * so they don't leak to child processes.
 */
export function readEnvFile(keys: string[]): Record<string, string> {
  const envFile = envFilePath();
  let content: string;
  try {
    content = fs.readFileSync(envFile, 'utf-8');
  } catch (err) {
    logger.debug({ err }, '.env file not found, falling back to process.env');
    content = '';
  }

  const result: Record<string, string> = {};
  const wanted = new Set(keys);

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    if (!wanted.has(key)) continue;
    let value = trimmed.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (value) result[key] = value;
  }

  // Fall back to process.env for keys not found in .env (e.g. Railway env vars)
  for (const key of keys) {
    if (!result[key] && process.env[key]) {
      result[key] = process.env[key]!;
    }
  }

  return result;
}

/**
 * Append or update an env var in the .env file.
 * If the key already exists, its value is replaced in-place.
 * Otherwise, the key=value pair is appended to the end.
 */
export function appendEnvVar(key: string, value: string): void {
  const envFile = envFilePath();
  let content = '';
  try {
    content = fs.readFileSync(envFile, 'utf-8');
  } catch {
    // File doesn't exist yet, will create
  }

  // Escape value if it contains special characters
  const needsQuotes = /[\s#"'=]/.test(value);
  const quotedValue = needsQuotes ? `"${value.replace(/"/g, '\\"')}"` : value;
  const newLine = `${key}=${quotedValue}`;

  // Check if key already exists
  const lines = content.split('\n');
  let found = false;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    if (trimmed.slice(0, eqIdx).trim() === key) {
      lines[i] = newLine;
      found = true;
      break;
    }
  }

  if (found) {
    fs.writeFileSync(envFile, lines.join('\n'));
  } else {
    // Append with newline
    const separator = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
    fs.appendFileSync(envFile, `${separator}${newLine}\n`);
  }

  logger.info({ key }, 'Environment variable written to .env');
}
