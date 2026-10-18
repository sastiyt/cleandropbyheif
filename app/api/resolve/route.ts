import { NextResponse } from "next/server";

const backend = process.env.MEDIA_BACKEND_URL;
export async function POST(request: Request) {
  if (!backend) return NextResponse.json({
    error: "Media backend is not configured. Set MEDIA_BACKEND_URL in your environment."
  }, { status: 503 });
  try {
    const body = await request.json();
    const response = await fetch(`${backend.replace(/\/$/, "")}/api/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ error: "Media backend is unreachable. Check MEDIA_BACKEND_URL." }, { status: 502 });
  }
}