import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
  const adsTxt = `google.com, pub-7215975042937417, DIRECT, f08c47fec0942fa0`;
  
  return new NextResponse(adsTxt, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
