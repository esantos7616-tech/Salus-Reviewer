// Check if SALUS API credentials are configured and working
import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/salus";

export async function GET() {
  const clientId = process.env.SALUS_CLIENT_ID;
  const clientSecret = process.env.SALUS_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { configured: false, message: "API credentials not set. Please configure your environment variables." },
      { status: 200 }
    );
  }

  try {
    await getAccessToken();
    return NextResponse.json({ configured: true, message: "Connected to SALUS API successfully." });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { configured: false, message: `Failed to connect: ${message}` },
      { status: 200 }
    );
  }
}
