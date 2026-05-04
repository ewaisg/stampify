import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// GET /api/pdf?storageUrl=<encoded-firebase-download-url>
//
// Server-side proxy: fetches the PDF from the Firebase Storage download URL
// on the server so the browser never touches firebasestorage.googleapis.com
// directly. Firebase download URLs include an auth token in the query string
// so no Authorization header is needed — the URL is already scoped.
//
// Security: only URLs pointing to firebasestorage.googleapis.com are allowed.
// ---------------------------------------------------------------------------

const ALLOWED_HOSTS = [
  "firebasestorage.googleapis.com",
  "storage.googleapis.com",
];

export async function GET(request: NextRequest) {
  try {
    const storageUrl = request.nextUrl.searchParams.get("storageUrl");

    if (!storageUrl) {
      return NextResponse.json(
        { error: "storageUrl is required." },
        { status: 400 },
      );
    }

    // Validate the URL points to Firebase Storage only
    let parsed: URL;
    try {
      parsed = new URL(storageUrl);
    } catch {
      return NextResponse.json({ error: "Invalid URL." }, { status: 400 });
    }

    if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
      return NextResponse.json({ error: "Forbidden host." }, { status: 403 });
    }

    // Server-side fetch — no CORS restrictions apply here
    const upstream = await fetch(storageUrl);

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Storage returned ${upstream.status}` },
        { status: upstream.status },
      );
    }

    const buffer = await upstream.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[api/pdf] Error:", err);
    return NextResponse.json(
      { error: "Failed to proxy PDF." },
      { status: 500 },
    );
  }
}
