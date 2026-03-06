import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const STORAGE_DIR = path.join(process.cwd(), ".data", "strategies");

interface SavedStrategy {
  id: string;
  name: string;
  script: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  lastResult?: {
    metrics: Record<string, number>;
    finalCapital: number;
    asset?: string;
    equityCurve?: { timestamp: number; equity: number; drawdown: number }[];
    context?: {
      asset?: string;
      timeframe?: string;
      from?: string;
      to?: string;
      mock?: boolean;
      mockType?: string;
      mockBars?: number;
    };
  };
}

async function ensureDir() {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
}

function safePath(id: string): string | null {
  const filePath = path.join(STORAGE_DIR, `${id}.json`);
  const resolved = path.resolve(filePath);
  if (
    !resolved.startsWith(path.resolve(STORAGE_DIR) + path.sep) &&
    resolved !== path.resolve(STORAGE_DIR)
  ) {
    return null;
  }
  return filePath;
}

function generateId(): string {
  return `strat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function GET(req: NextRequest) {
  try {
    await ensureDir();

    const id = req.nextUrl.searchParams.get("id");

    if (id) {
      const filePath = safePath(id);
      if (!filePath) {
        return NextResponse.json({ error: "Invalid id" }, { status: 400 });
      }
      try {
        const data = await fs.readFile(filePath, "utf-8");
        return NextResponse.json(JSON.parse(data));
      } catch {
        return NextResponse.json(
          { error: "Strategy not found" },
          { status: 404 },
        );
      }
    }

    // List all strategies
    const files = await fs.readdir(STORAGE_DIR);
    const strategies: SavedStrategy[] = [];

    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      try {
        const data = await fs.readFile(path.join(STORAGE_DIR, file), "utf-8");
        strategies.push(JSON.parse(data));
      } catch {
        // Skip corrupted files
      }
    }

    // Sort by updatedAt descending
    strategies.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );

    return NextResponse.json({ strategies });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/strategies — save a new strategy
 */
export async function POST(req: NextRequest) {
  try {
    await ensureDir();
    const body = await req.json();
    const { name, script, description, lastResult } = body;

    if (!name || !script) {
      return NextResponse.json(
        { error: "name and script are required" },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const strategy: SavedStrategy = {
      id: generateId(),
      name,
      script,
      description,
      createdAt: now,
      updatedAt: now,
      lastResult,
    };

    await fs.writeFile(
      path.join(STORAGE_DIR, `${strategy.id}.json`),
      JSON.stringify(strategy, null, 2),
    );

    return NextResponse.json(strategy, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PUT /api/strategies — update an existing strategy
 */
export async function PUT(req: NextRequest) {
  try {
    await ensureDir();
    const body = await req.json();
    const { id, name, script, description, lastResult } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const filePath = safePath(id);
    if (!filePath) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    let existing: SavedStrategy;

    try {
      const data = await fs.readFile(filePath, "utf-8");
      existing = JSON.parse(data);
    } catch {
      return NextResponse.json(
        { error: "Strategy not found" },
        { status: 404 },
      );
    }

    const updated: SavedStrategy = {
      ...existing,
      name: name ?? existing.name,
      script: script ?? existing.script,
      description: description ?? existing.description,
      updatedAt: new Date().toISOString(),
      lastResult: lastResult ?? existing.lastResult,
    };

    await fs.writeFile(filePath, JSON.stringify(updated, null, 2));
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/strategies?id=xxx — delete a strategy
 */
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const filePath = safePath(id);
    if (!filePath) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    try {
      await fs.unlink(filePath);
    } catch {
      return NextResponse.json(
        { error: "Strategy not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ deleted: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
