export const runtime = "nodejs";
export async function POST(request: Request) {
  const backend = process.env.MEDIA_BACKEND_URL;
  if (!backend) return Response.json({ error: "Media backend is not configured." }, { status: 503 });
  try {
    const body = await request.json();
    const response = await fetch(`${backend.replace(/\/$/, "")}/api/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return Response.json(data, { status: response.status });
    }
    return new Response(response.body, {
      status: 200,
      headers: {
        "Content-Type": response.headers.get("content-type") || "application/octet-stream",
        "Content-Disposition": response.headers.get("content-disposition") || 'attachment; filename="cleandrop-media"',
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json({ error: "Media backend is unreachable." }, { status: 502 });
  }
}