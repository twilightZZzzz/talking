import { connection } from 'next/server';
import { aiStatus } from '@/server/ai/config';

export async function GET() {
  await connection();
  return Response.json(aiStatus());
}
