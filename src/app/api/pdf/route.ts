import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// GET /api/pdf?fileId=<id>
// Header: Authorization: Bearer <firebase-id-token>
//
// Server-side proxy: fetches the PDF from Firebase Storage using the user's
// own Firebase ID token. This avoids CORS restrictions that block XHR/fetch
// requests made directly from the browser to firebasestorage.googleapis.com.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const fileId = searchParams.get("fileId");
    const uid = searchParams.get("uid");

    if (!fileId || !uid) {
      return NextResponse.json(
        { error: "fileId and uid are required." },
        { status: 400 },
      );
    }

    // Forward the caller's Firebase ID token so Storage rules can evaluate it
    const authHeader = request.headers.get("Authorization") ?? "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken) {
      return NextResponse.json(
        { error: "Missing Authorization header." },
        { status: 401 },
      );
    }

    const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!bucket) {
      return NextResponse.json(
        { error: "Storage bucket not configured." },
        { status: 500 },
      );
    }

    // Firebase Storage REST API: download object with auth token
    const objectPath = encodeURIComponent(`users/${uid}/files/${fileId}.pdf`);
    const storageUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${objectPath}?alt=media`;

    const upstream = await fetch(storageUrl, {
      headers: { Authorization: `Bearer ${idToken}` },
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      return NextResponse.json(
        { error: `Storage returned ${upstream.status}: ${text}` },
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
    const message = err instanceof Error ? err.message : "Internal server error.";
    console.error("[api/pdf] Error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
