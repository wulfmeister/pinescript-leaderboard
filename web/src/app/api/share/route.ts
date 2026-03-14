import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { ensureDir, safePath, generateId } from "../../lib/storage";

const STORAGE_DIR = path.join(process.cwd(), ".data", "shares");

interface ShareSnapshot {
  id: string;
  script: string;
  asset: string;
  capital: number;
  dataSettings: {
    timeframe: string;
    from: string;
    to: string;
    useMock: boolean;
    mockType: "random" | "bull" | "bear";
    mockBars: number;
  };
  createdAt: string;
}

export async function GET(req: NextRequest) {
  try {
    await ensureDir(STORAGE_DIR);
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const filePath = safePath(STORAGE_DIR, id);
    if (!filePath) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    try {
      const data = await fs.readFile(filePath, "utf-8");
      return NextResponse.json(JSON.parse(data));
    } catch {
      return NextResponse.json(
        { error: "Shared backtest not found" },
        { status: 404 },
      );
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDir(STORAGE_DIR);
    const body = await req.json();
    const { script, asset, capital, dataSettings } = body;

    if (!script || typeof script !== "string" || !script.trim()) {
      return NextResponse.json(
        { error: "script is required" },
        { status: 400 },
      );
    }

    const snapshot: ShareSnapshot = {
      id: generateId("sh"),
      script,
      asset: asset ?? "AAPL",
      capital: capital ?? 10000,
      dataSettings: dataSettings || {
        timeframe: "1d",
        from: "",
        to: "",
        useMock: true,
        mockType: "random",
        mockBars: 252,
      },
      createdAt: new Date().toISOString(),
    };

    await fs.writeFile(
      path.join(STORAGE_DIR, `${snapshot.id}.json`),
      JSON.stringify(snapshot, null, 2),
    );

    return NextResponse.json({ id: snapshot.id }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
