import type {
  BacktestResult,
  OHLCV,
  Trade,
  PerformanceMetrics,
} from "@pinescript-utils/core";

/**
 * Report generation options
 */
export interface ReportOptions {
  title: string;
  strategyName: string;
  symbol: string;
  timeframe: string;
  includeCharts: boolean;
  includeTradeList: boolean;
  theme: "light" | "dark";
}

/**
 * Default report options
 */
export const DEFAULT_REPORT_OPTIONS: ReportOptions = {
  title: "Backtest Report",
  strategyName: "Strategy",
  symbol: "",
  timeframe: "1d",
  includeCharts: true,
  includeTradeList: true,
  theme: "light",
};

/**
 * Generate an HTML report from backtest results
 */
export function generateHTMLReport(
  result: BacktestResult,
  data: OHLCV[],
  options: Partial<ReportOptions> = {},
): string {
  const opts = { ...DEFAULT_REPORT_OPTIONS, ...options };

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${opts.title}</title>
    <!-- CDN version must match web/package.json lightweight-charts version (currently ^5.1.0) -->
    <script src="https://unpkg.com/lightweight-charts@5.1.0/dist/lightweight-charts.standalone.production.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: ${opts.theme === "dark" ? "#1a1a1a" : "#f5f5f5"};
            color: ${opts.theme === "dark" ? "#e0e0e0" : "#333"};
            line-height: 1.6;
            padding: 20px;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
        }
        
        .header {
            background: ${opts.theme === "dark" ? "#2d2d2d" : "#fff"};
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
            color: ${opts.theme === "dark" ? "#fff" : "#2c3e50"};
        }
        
        .header .subtitle {
            color: ${opts.theme === "dark" ? "#888" : "#666"};
            font-size: 1.1em;
        }
        
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }
        
        .metric-card {
            background: ${opts.theme === "dark" ? "#2d2d2d" : "#fff"};
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            transition: transform 0.2s;
        }
        
        .metric-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.15);
        }
        
        .metric-label {
            font-size: 0.9em;
            color: ${opts.theme === "dark" ? "#888" : "#666"};
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 5px;
        }
        
        .metric-value {
            font-size: 1.8em;
            font-weight: 600;
            color: ${opts.theme === "dark" ? "#fff" : "#2c3e50"};
        }
        
        .metric-value.positive {
            color: #27ae60;
        }
        
        .metric-value.negative {
            color: #e74c3c;
        }
        
        .chart-container {
            background: ${opts.theme === "dark" ? "#2d2d2d" : "#fff"};
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .chart-container h2 {
            margin-bottom: 20px;
            color: ${opts.theme === "dark" ? "#fff" : "#2c3e50"};
        }
        
        .chart-wrapper {
            position: relative;
            height: 400px;
        }
        
        .trade-list {
            background: ${opts.theme === "dark" ? "#2d2d2d" : "#fff"};
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .trade-list h2 {
            margin-bottom: 20px;
            color: ${opts.theme === "dark" ? "#fff" : "#2c3e50"};
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
        }
        
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid ${opts.theme === "dark" ? "#444" : "#ddd"};
        }
        
        th {
            font-weight: 600;
            color: ${opts.theme === "dark" ? "#aaa" : "#666"};
            text-transform: uppercase;
            font-size: 0.85em;
            letter-spacing: 0.5px;
        }
        
        tr:hover {
            background: ${opts.theme === "dark" ? "#3d3d3d" : "#f9f9f9"};
        }
        
        .positive {
            color: #27ae60;
        }
        
        .negative {
            color: #e74c3c;
        }
        
        .section {
            margin-bottom: 30px;
        }
        
        .footer {
            text-align: center;
            padding: 20px;
            color: ${opts.theme === "dark" ? "#666" : "#999"};
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${opts.title}</h1>
            <div class="subtitle">
                ${opts.strategyName} • ${opts.symbol} • ${opts.timeframe}<br>
                Generated on ${new Date().toLocaleString()}
            </div>
        </div>

        <div class="section">
            <div class="metrics-grid">
                ${generateMetricCards(result, opts.theme)}
            </div>
        </div>

        ${opts.includeCharts ? generateChartsSection(result, opts.theme) : ""}

        ${opts.includeTradeList ? generateTradeListSection(result, opts.theme) : ""}

        ${generateSummarySection(result, opts.theme)}

        <div class="footer">
            Generated by PineScript Utils
        </div>
    </div>

    ${opts.includeCharts ? generateChartScripts(result, opts.theme) : ""}
</body>
</html>`;
}

function generateMetricCards(result: BacktestResult, theme: string): string {
  const metrics = result.metrics;
  const formatPercent = (v: number) => `${(v * 100).toFixed(2)}%`;
  const formatCurrency = (v: number) =>
    `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const cards = [
    {
      label: "Total Return",
      value: formatPercent(metrics.totalReturn),
      positive: metrics.totalReturn >= 0,
    },
    {
      label: "Annualized Return",
      value: formatPercent(metrics.annualizedReturn),
      positive: metrics.annualizedReturn >= 0,
    },
    { label: "Total Trades", value: metrics.totalTrades.toString() },
    {
      label: "Win Rate",
      value: formatPercent(metrics.winRate),
      positive: metrics.winRate >= 0.5,
    },
    {
      label: "Profit Factor",
      value: metrics.profitFactor.toFixed(2),
      positive: metrics.profitFactor >= 1,
    },
    {
      label: "Sharpe Ratio",
      value: metrics.sharpeRatio.toFixed(2),
      positive: metrics.sharpeRatio >= 1,
    },
    {
      label: "Sortino Ratio",
      value: metrics.sortinoRatio.toFixed(2),
      positive: metrics.sortinoRatio >= 1,
    },
    {
      label: "Max Drawdown",
      value: formatPercent(metrics.maxDrawdown),
      positive: false,
    },
    { label: "Volatility", value: formatPercent(metrics.volatility) },
    { label: "Initial Capital", value: formatCurrency(result.initialCapital) },
    {
      label: "Final Capital",
      value: formatCurrency(result.finalCapital),
      positive: result.finalCapital >= result.initialCapital,
    },
    {
      label: "Expectancy",
      value: formatCurrency(metrics.expectancy),
      positive: metrics.expectancy >= 0,
    },
  ];

  return cards
    .map(
      (card) => `
    <div class="metric-card">
        <div class="metric-label">${card.label}</div>
        <div class="metric-value ${card.positive ? "positive" : card.positive === false ? "negative" : ""}">${card.value}</div>
    </div>`,
    )
    .join("");
}

function generateChartsSection(result: BacktestResult, theme: string): string {
  return `
        <div id="tooltip" style="position:absolute;display:none;background:#1c1c1e;border:1px solid #3f3f46;border-radius:4px;padding:4px 8px;font-size:12px;color:#fff;pointer-events:none;z-index:100;"></div>

        <div class="section">
            <div class="chart-container">
                <h2>Equity Curve</h2>
                <button onclick="equityChart.timeScale().resetTimeScale(); equityChart.priceScale('right').applyOptions({autoScale:true});" style="margin-bottom:8px;padding:4px 12px;cursor:pointer;border:1px solid #3f3f46;border-radius:4px;background:#1c1c1e;color:#fff;font-size:12px;">Reset Zoom</button>
                <div class="chart-wrapper">
                    <div id="equityChart" style="height: 400px;"></div>
                </div>
            </div>
        </div>

        <div class="section">
            <div class="chart-container">
                <h2>Drawdown</h2>
                <button onclick="drawdownChart.timeScale().resetTimeScale(); drawdownChart.priceScale('right').applyOptions({autoScale:true});" style="margin-bottom:8px;padding:4px 12px;cursor:pointer;border:1px solid #3f3f46;border-radius:4px;background:#1c1c1e;color:#fff;font-size:12px;">Reset Zoom</button>
                <div class="chart-wrapper">
                    <div id="drawdownChart" style="height: 400px;"></div>
                </div>
            </div>
        </div>

        <div class="section">
            <div class="chart-container">
                <h2>Monthly Returns</h2>
                <button onclick="monthlyChart.timeScale().resetTimeScale(); monthlyChart.priceScale('right').applyOptions({autoScale:true});" style="margin-bottom:8px;padding:4px 12px;cursor:pointer;border:1px solid #3f3f46;border-radius:4px;background:#1c1c1e;color:#fff;font-size:12px;">Reset Zoom</button>
                <div class="chart-wrapper">
                    <div id="monthlyReturnsChart" style="height: 400px;"></div>
                </div>
            </div>
        </div>`;
}

function generateTradeListSection(
  result: BacktestResult,
  theme: string,
): string {
  const closingTrades = result.trades.filter((t) => t.pnl !== undefined);

  if (closingTrades.length === 0) {
    return `
        <div class="section">
            <div class="trade-list">
                <h2>Trade History</h2>
                <p>No completed trades.</p>
            </div>
        </div>`;
  }

  const rows = closingTrades
    .map(
      (trade) => `
        <tr>
            <td>${new Date(trade.timestamp).toLocaleString()}</td>
            <td>${trade.direction.toUpperCase()}</td>
            <td>${trade.action.toUpperCase()}</td>
            <td>$${trade.price.toFixed(2)}</td>
            <td>${trade.quantity.toFixed(4)}</td>
            <td class="${(trade.pnl || 0) >= 0 ? "positive" : "negative"}">${trade.pnl !== undefined ? "$" + trade.pnl.toFixed(2) : "-"}</td>
        </tr>`,
    )
    .join("");

  return `
        <div class="section">
            <div class="trade-list">
                <h2>Trade History</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Direction</th>
                            <th>Action</th>
                            <th>Price</th>
                            <th>Quantity</th>
                            <th>P&L</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        </div>`;
}

function generateChartScripts(result: BacktestResult, theme: string): string {
  // Deduplicate equity data by date (LW Charts requires strictly increasing time)
  const equityByDate = new Map<string, number>();
  for (const e of result.equityCurve) {
    const date = new Date(e.timestamp).toISOString().split("T")[0];
    equityByDate.set(date, e.equity);
  }
  const equityData = Array.from(equityByDate.entries()).map(
    ([time, value]) => ({ time, value }),
  );

  const drawdownByDate = new Map<string, number>();
  for (const e of result.equityCurve) {
    const date = new Date(e.timestamp).toISOString().split("T")[0];
    drawdownByDate.set(date, e.drawdown * 100);
  }
  const drawdownData = Array.from(drawdownByDate.entries()).map(
    ([time, value]) => ({ time, value }),
  );

  const monthlyReturns = calculateMonthlyReturns(result.equityCurve);
  const monthlyData = monthlyReturns.map((r) => ({
    time: r.month + "-01",
    value: r.return * 100,
    color: r.return >= 0 ? "#27ae60" : "#e74c3c",
  }));

  const bgColor = theme === "dark" ? "#18181b" : "#ffffff";
  const textColor = theme === "dark" ? "#a1a1aa" : "#2c3e50";
  const gridColor = theme === "dark" ? "rgba(63,63,70,0.4)" : "rgba(0,0,0,0.1)";

  return `
    <script>
        const chartLayout = {
            background: { type: LightweightCharts.ColorType.Solid, color: '${bgColor}' },
            textColor: '${textColor}',
        };
        const chartGrid = {
            vertLines: { color: '${gridColor}' },
            horzLines: { color: '${gridColor}' },
        };

        const equityChart = LightweightCharts.createChart(document.getElementById('equityChart'), {
            height: 400,
            layout: chartLayout,
            grid: chartGrid,
            timeScale: { borderColor: '${gridColor}' },
            rightPriceScale: { borderColor: '${gridColor}' },
        });
        const equitySeries = equityChart.addSeries(LightweightCharts.LineSeries, {
            color: '#3498db',
            lineWidth: 2,
        });
        equitySeries.setData(${JSON.stringify(equityData)});
        equityChart.timeScale().fitContent();
        equityChart.subscribeCrosshairMove(function(param) {
            var tooltip = document.getElementById('tooltip');
            if (!param.point || !param.time) { tooltip.style.display = 'none'; return; }
            var price = param.seriesData.values().next().value;
            if (!price) { tooltip.style.display = 'none'; return; }
            var val = price.value !== undefined ? price.value : price.close;
            tooltip.innerHTML = '$' + val.toFixed(2);
            tooltip.style.display = 'block';
            tooltip.style.left = (param.point.x + 15) + 'px';
            tooltip.style.top = (param.point.y - 20) + 'px';
        });

        const drawdownChart = LightweightCharts.createChart(document.getElementById('drawdownChart'), {
            height: 400,
            layout: chartLayout,
            grid: chartGrid,
            timeScale: { borderColor: '${gridColor}' },
            rightPriceScale: {
                borderColor: '${gridColor}',
                invertScale: true,
            },
        });
        const drawdownSeries = drawdownChart.addSeries(LightweightCharts.AreaSeries, {
            topColor: 'rgba(231, 76, 60, 0.1)',
            bottomColor: 'rgba(231, 76, 60, 0.4)',
            lineColor: '#e74c3c',
            lineWidth: 2,
        });
        drawdownSeries.setData(${JSON.stringify(drawdownData)});
        drawdownChart.timeScale().fitContent();
        drawdownChart.subscribeCrosshairMove(function(param) {
            var tooltip = document.getElementById('tooltip');
            if (!param.point || !param.time) { tooltip.style.display = 'none'; return; }
            var price = param.seriesData.values().next().value;
            if (!price) { tooltip.style.display = 'none'; return; }
            var val = price.value !== undefined ? price.value : price.close;
            tooltip.innerHTML = '$' + val.toFixed(2);
            tooltip.style.display = 'block';
            tooltip.style.left = (param.point.x + 15) + 'px';
            tooltip.style.top = (param.point.y - 20) + 'px';
        });

        const monthlyChart = LightweightCharts.createChart(document.getElementById('monthlyReturnsChart'), {
            height: 400,
            layout: chartLayout,
            grid: chartGrid,
            timeScale: { borderColor: '${gridColor}' },
            rightPriceScale: { borderColor: '${gridColor}' },
        });
        const monthlySeries = monthlyChart.addSeries(LightweightCharts.HistogramSeries, {});
        monthlySeries.setData(${JSON.stringify(monthlyData)});
        monthlyChart.timeScale().fitContent();
        monthlyChart.subscribeCrosshairMove(function(param) {
            var tooltip = document.getElementById('tooltip');
            if (!param.point || !param.time) { tooltip.style.display = 'none'; return; }
            var price = param.seriesData.values().next().value;
            if (!price) { tooltip.style.display = 'none'; return; }
            var val = price.value !== undefined ? price.value : price.close;
            tooltip.innerHTML = '$' + val.toFixed(2);
            tooltip.style.display = 'block';
            tooltip.style.left = (param.point.x + 15) + 'px';
            tooltip.style.top = (param.point.y - 20) + 'px';
        });
    </script>`;
}

function generateSummarySection(result: BacktestResult, theme: string): string {
  const m = result.metrics;
  const trades = result.trades.filter((t) => t.pnl !== undefined);

  // Win/Loss streak analysis
  let maxWinStreak = 0;
  let maxLossStreak = 0;
  let currentWinStreak = 0;
  let currentLossStreak = 0;

  for (const trade of trades) {
    if ((trade.pnl || 0) > 0) {
      currentWinStreak++;
      currentLossStreak = 0;
      maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
    } else {
      currentLossStreak++;
      currentWinStreak = 0;
      maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
    }
  }

  // Risk/Reward ratio
  const riskReward = m.averageLoss > 0 ? m.averageWin / m.averageLoss : 0;

  // Recovery factor: totalReturn / maxDrawdown
  const recoveryFactor = m.maxDrawdown > 0 ? m.totalReturn / m.maxDrawdown : 0;

  const bgColor = theme === "dark" ? "#2d2d2d" : "#fff";
  const textColor = theme === "dark" ? "#e0e0e0" : "#333";
  const mutedColor = theme === "dark" ? "#888" : "#666";

  return `
        <div class="section">
            <div style="background: ${bgColor}; padding: 20px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <h2 style="margin-bottom: 20px; color: ${theme === "dark" ? "#fff" : "#2c3e50"};">Advanced Analytics</h2>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
                    <div>
                        <div style="font-size: 0.85em; color: ${mutedColor}; text-transform: uppercase;">Risk/Reward Ratio</div>
                        <div style="font-size: 1.4em; font-weight: 600; color: ${textColor};">${riskReward.toFixed(2)}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.85em; color: ${mutedColor}; text-transform: uppercase;">Recovery Factor</div>
                        <div style="font-size: 1.4em; font-weight: 600; color: ${textColor};">${recoveryFactor.toFixed(2)}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.85em; color: ${mutedColor}; text-transform: uppercase;">Max Win Streak</div>
                        <div style="font-size: 1.4em; font-weight: 600; color: #27ae60;">${maxWinStreak}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.85em; color: ${mutedColor}; text-transform: uppercase;">Max Loss Streak</div>
                        <div style="font-size: 1.4em; font-weight: 600; color: #e74c3c;">${maxLossStreak}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.85em; color: ${mutedColor}; text-transform: uppercase;">Avg Win</div>
                        <div style="font-size: 1.4em; font-weight: 600; color: #27ae60;">$${m.averageWin.toFixed(2)}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.85em; color: ${mutedColor}; text-transform: uppercase;">Avg Loss</div>
                        <div style="font-size: 1.4em; font-weight: 600; color: #e74c3c;">$${m.averageLoss.toFixed(2)}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.85em; color: ${mutedColor}; text-transform: uppercase;">Expectancy</div>
                        <div style="font-size: 1.4em; font-weight: 600; color: ${m.expectancy >= 0 ? "#27ae60" : "#e74c3c"};">$${m.expectancy.toFixed(2)}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.85em; color: ${mutedColor}; text-transform: uppercase;">Volatility</div>
                        <div style="font-size: 1.4em; font-weight: 600; color: ${textColor};">${(m.volatility * 100).toFixed(2)}%</div>
                    </div>
                </div>
            </div>
        </div>`;
}

function calculateMonthlyReturns(
  equityCurve: { timestamp: number; equity: number; drawdown: number }[],
): { month: string; return: number }[] {
  if (equityCurve.length < 2) return [];

  const monthlyData = new Map<string, { start: number; end: number }>();

  for (const point of equityCurve) {
    const date = new Date(point.timestamp);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    if (!monthlyData.has(monthKey)) {
      monthlyData.set(monthKey, { start: point.equity, end: point.equity });
    } else {
      const data = monthlyData.get(monthKey)!;
      data.end = point.equity;
    }
  }

  const returns: { month: string; return: number }[] = [];
  for (const [month, data] of monthlyData) {
    const monthlyReturn = (data.end - data.start) / data.start;
    returns.push({ month, return: monthlyReturn });
  }

  return returns.sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Save an HTML report to file
 */
export async function saveHTMLReport(
  result: BacktestResult,
  data: OHLCV[],
  outputPath: string,
  options: Partial<ReportOptions> = {},
): Promise<void> {
  const fs = await import("fs");
  const html = generateHTMLReport(result, data, options);
  fs.writeFileSync(outputPath, html, "utf-8");
}

export default { generateHTMLReport, saveHTMLReport };
