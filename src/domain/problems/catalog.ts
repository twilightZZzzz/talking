// CONTRACT STUB — реализует агент domain.
import type { ProblemCode } from '../types';

export interface ProblemInfo {
  code: ProblemCode;
  title: string; // «Слова-паразиты»
  short: string; // одна строка: что это
  tip: string; // короткий совет тренера
  source: 'code' | 'ai';
}
export const PROBLEMS: ProblemInfo[] = [];
export function problemInfo(code: ProblemCode): ProblemInfo | undefined {
  return PROBLEMS.find((p) => p.code === code);
}
