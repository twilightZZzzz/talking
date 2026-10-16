import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const cache = new Map<string, string>();

/** Читает prompts/<name> из корня проекта (на Vercel нужен outputFileTracingIncludes для ./prompts/**) */
export function loadPrompt(name: string): string {
  let text = cache.get(name);
  if (text === undefined) {
    text = readFileSync(join(process.cwd(), 'prompts', name), 'utf8');
    cache.set(name, text);
  }
  return text;
}
