import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '../data');
const PRATOS_FILE = resolve(DATA_DIR, 'pratos.json');
const PEDIDOS_FILE = resolve(DATA_DIR, 'pedidos.json');
const USERS_FILE = resolve(DATA_DIR, 'users.json');

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

export function readJson<T>(file: string, fallback: T): T {
  try {
    if (!existsSync(file)) return fallback;
    const raw = readFileSync(file, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson<T>(file: string, data: T): void {
  ensureDataDir();
  writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

export const paths = { DATA_DIR, PRATOS_FILE, PEDIDOS_FILE, USERS_FILE };
