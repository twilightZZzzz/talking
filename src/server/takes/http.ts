import { NextResponse } from 'next/server';

export const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
export const ok = <T>(data: T, status = 200) => NextResponse.json(data, { status });

export const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}
