// CONTRACT STUB — реализует агент domain.
import type { Exercise } from '../types';

export const EXERCISES: Exercise[] = [];
export function getExercise(id: string): Exercise | undefined {
  return EXERCISES.find((e) => e.id === id);
}
