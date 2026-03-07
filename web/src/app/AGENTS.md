# web/src/app

Next.js 14 App Router. All pages are client components (`"use client"`) with React hook state management.

## Structure

```
app/
├── layout.tsx              # Root layout with nav
├── nav.tsx                 # Navigation bar (shared across all pages)
├── page.tsx                # Home/landing page with feature overview
├── globals.css             # Tailwind base styles
├── components/
│   ├── data-settings.tsx   # CANONICAL mock/real data selector — use everywhere
│   └── __tests__/
├── backtest/
│   ├── page.tsx            # Strategy editor + run + charts + overlays
│   └── components/         # 10 components: EquityChart, TradeTable, SignalOverlay, etc.
├── optimize/
│   ├── page.tsx            # 917 lines — parameter ranges + heatmap + run inspection
│   ├── components/         # Heatmap visualization components
│   └── utils/              # transformHeatmapData and helpers
├── rank/page.tsx           # 602 lines — multi-strategy comparison
├── walk-forward/page.tsx   # 565 lines — window config + efficiency metrics
├── arena/page.tsx          # 714 lines — generate/chat/tournament tabs
├── portfolio/
│   ├── page.tsx            # Multi-asset backtest + correlation matrix
│   └── components/         # Portfolio-specific chart components
├── export/page.tsx         # Template-based PineScript code generation
└── api/                    # API routes (see below)
```

## Page pattern (all pages follow this)

```typescript
"use client";
// 1. State: loading/error/result + form inputs
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [result, setResult] = useState<ResultType | null>(null);

// 2. Form with DataSettings component for mock/real toggle
<DataSettings value={dataSettings} onChange={setDataSettings} />

// 3. Submit → POST to /api/{name} → setResult
// 4. Conditional render: loading spinner | error message | result charts/tables
```

## API route pattern (`api/*/route.ts`)

All routes follow: parse body → validate fields → fetch data (mock or real) → invoke package function → return JSON.

Validation checks repeated across routes:

- Date order (`startDate < endDate`)
- Mock bar bounds (50–2000 for most; walk-forward defaults 500)
- Required fields: `script`, `asset`/`assets`, `initialCapital`

Shared payload fields: `script`, `asset(s)`, `initialCapital`, `timeframe`, `startDate`/`endDate`, `useMock`/`mockType`/`mockBars`.

## Shared components

**`DataSettings`** (`components/data-settings.tsx`): The single source of truth for mock/real data selection. All pages MUST use this — never duplicate the toggle.

**`formatDataSourceBadge(...)`**: Shows "Mock Data" / "Real Data" badge in results. Use wherever backtest results are displayed.

## Chart conventions

- Chart.js with `react-chartjs-2`. Zoom/pan via `chartjs-plugin-zoom` (lazy-registered).
- Always include a `Reset Zoom` button when zoom is enabled.
- `animation: false` in all chart configs for responsiveness.
- Equity charts used in backtest and portfolio views.

## Gotchas

- Large page files (optimize: 917, arena: 714, rank: 602, walk-forward: 565 lines). Heavy state management in each.
- `web/src/components/` and `web/src/lib/` exist but are mostly empty — shared components live under `app/components/`.
- The `@/*` path alias maps to `./src/*` (configured in `web/tsconfig.json`).
- Web dev server uses dynamic port selection via `scripts/find-port.mjs` starting from 3000.
- `next.config.mjs` has `transpilePackages` for all `@pinescript-utils/*` packages.
