import { promises as fs } from "fs";
import path from "path";

export async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export function safePath(storageDir: string, id: string): string | null {
  const filePath = path.join(storageDir, `${id}.json`);
  const resolved = path.resolve(filePath);
  if (
    !resolved.startsWith(path.resolve(storageDir) + path.sep) &&
    resolved !== path.resolve(storageDir)
  ) {
    return null;
  }
  return filePath;
}

export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
