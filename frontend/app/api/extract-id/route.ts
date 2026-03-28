import { NextResponse } from 'next/server';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

export async function POST(req: Request) {
  try {
    if (!GOOGLE_API_KEY) {
      return NextResponse.json({ error: 'GOOGLE_API_KEY is not configured' }, { status: 500 });
    }

    const { image } = (await req.json()) as { image: string };
    if (!image) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType: 'image/jpeg',
                    data: image,
                  },
                },
                {
                  text: "Extract the following fields from this photo ID / driver's license image and return them as a JSON object with exactly these keys: fullName, dob, address. If a field is not visible, use an empty string. Return only valid JSON, no markdown.",
                },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      return NextResponse.json({ error: 'Failed to process image' }, { status: 502 });
    }

    const data = await response.json();
    let text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    text = text.trim();
    if (text.startsWith('```')) {
      text = text.split('\n').slice(1).join('\n');
      text = text.replace(/```\s*$/, '').trim();
    }

    const extracted = JSON.parse(text) as { fullName: string; dob: string; address: string };
    return NextResponse.json(extracted);
  } catch (error) {
    console.error('Extract ID error:', error);
    return NextResponse.json({ error: 'Failed to extract ID data' }, { status: 500 });
  }
}
