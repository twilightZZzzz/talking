// CONTRACT STUB — реализует агент domain (перенос каталогов из legacy/index.html).
import type { Challenge, Frame } from '../types';

export const CONTENT_VERSION = 1;
export const TWISTERS: { id: string; text: string }[] = [];
export const TOPICS: { id: string; text: string }[] = [];
export const FRAMES: Frame[] = [];
export const CHALLENGES: Challenge[] = [];

export function getFrame(id: string | null | undefined): Frame | undefined {
  return FRAMES.find((f) => f.id === id);
}
export function getChallenge(id: string | null | undefined): Challenge | undefined {
  return CHALLENGES.find((c) => c.id === id);
}
export function getTopicText(id: string | null | undefined): string | undefined {
  return TOPICS.find((t) => t.id === id)?.text;
}
