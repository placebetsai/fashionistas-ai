import { NextRequest, NextResponse } from 'next/server';

const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`;

export async function POST(req: NextRequest) {
  if (!GEMINI_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
  }

  const { occasion, weather, budget, style } = await req.json();

  if (!occasion) {
    return NextResponse.json({ error: 'occasion is required' }, { status: 400 });
  }

  const prompt = `You are a professional fashion stylist AI. Generate a complete outfit recommendation.

Occasion: ${occasion}
Weather: ${weather || 'Mild'}
Budget: ${budget || '$50-$150'}
Style preference: ${style || 'Classic'}

Return ONLY valid JSON (no markdown, no code fences) with this exact structure:
{
  "top": "specific garment recommendation with color and material",
  "bottom": "specific garment recommendation with color and material",
  "shoes": "specific shoe recommendation with style and color",
  "accessories": "specific accessory recommendations (2-3 items)",
  "tip": "one practical style tip for this specific occasion"
}

Be specific and creative. Name real garment types, colors, and materials. Consider the weather and budget. Make it feel like a real stylist talking to a friend.`;

  try {
    const resp = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 512,
          temperature: 0.7,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error('[stylist] Gemini error:', resp.status, err.slice(0, 200));
      return NextResponse.json({ error: 'AI service unavailable' }, { status: 502 });
    }

    const data = await resp.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[stylist] No JSON in response:', text.slice(0, 200));
      return NextResponse.json({ error: 'Invalid AI response' }, { status: 500 });
    }

    const outfit = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ outfit });
  } catch (err: any) {
    console.error('[stylist] Error:', err.message);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
