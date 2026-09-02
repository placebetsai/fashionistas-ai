import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { email, source } = await req.json();

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
  }

  console.log(`[subscribe] New subscriber: ${email} (source: ${source || 'unknown'})`);

  return NextResponse.json({ ok: true, message: 'Subscribed successfully!' });
}
