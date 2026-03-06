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
  options: Partial<ReportOptions> = {}
): string {
  const opts = { ...DEFAULT_REPORT_OPTIONS, ...options };

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${opts.title}</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
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

    ${opts.includeCharts ? generateChartScripts(result) : ""}
</body>
</html>`;
}

function generateMetricCards(result: BacktestResult, theme: string): string {
  const metrics = result.metrics;
  const formatPercent = (v: number) => `${(v * 100).toFixed(2)}%`;
  const formatCurrency = (v: number) =>
    `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const cards = [
    { label: "Total Return", value: formatPercent(metrics.totalReturn), positive: metrics.totalReturn >= 0 },
    { label: "Annualized Return", value: formatPercent(metrics.annualizedReturn), positive: metrics.annualizedReturn >= 0 },
    { label: "Total Trades", value: metrics.totalTrades.toString() },
    { label: "Win Rate", value: formatPercent(metrics.winRate), positive: metrics.winRate >= 0.5 },
    { label: "Profit Factor", value: metrics.profitFactor.toFixed(2), positive: metrics.profitFactor >= 1 },
    { label: "Sharpe Ratio", value: metrics.sharpeRatio.toFixed(2), positive: metrics.sharpeRatio >= 1 },
    { label: "Sortino Ratio", value: metrics.sortinoRatio.toFixed(2), positive: metrics.sortinoRatio >= 1 },
    { label: "Max Drawdown", value: formatPercent(metrics.maxDrawdown), positive: false },
    { label: "Volatility", value: formatPercent(metrics.volatility) },
    { label: "Initial Capital", value: formatCurrency(result.initialCapital) },
    { label: "Final Capital", value: formatCurrency(result.finalCapital), positive: result.finalCapital >= result.initialCapital },
    { label: "Expectancy", value: formatCurrency(metrics.expectancy), positive: metrics.expectancy >= 0 },
  ];

  return cards
    .map(
      (card) => `
    <div class="metric-card">
        <div class="metric-label">${card.label}</div>
        <div class="metric-value ${card.positive ? "positive" : card.positive === false ? "negative" : ""}">${card.value}</div>
    </div>`
    )
    .join("");
}

function generateChartsSection(result: BacktestResult, theme: string): string {
  return `
        <div class="section">
            <div class="chart-container">
                <h2>Equity Curve</h2>
                <div class="chart-wrapper">
                    <canvas id="equityChart"></canvas>
                </div>
            </div>
        </div>

        <div class="section">
            <div class="chart-container">
                <h2>Drawdown</h2>
                <div class="chart-wrapper">
                    <canvas id="drawdownChart"></canvas>
                </div>
            </div>
        </div>

        <div class="section">
            <div class="chart-container">
                <h2>Monthly Returns</h2>
                <div class="chart-wrapper">
                    <canvas id="monthlyReturnsChart"></canvas>
                </div>
            </div>
        </div>`;
}

function generateTradeListSection(result: BacktestResult, theme: string): string {
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
        </tr>`
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

function generateChartScripts(result: BacktestResult): string {
  const equityData = result.equityCurve.map((e) => ({
    x: new Date(e.timestamp).toISOString().split("T")[0],
    y: e.equity,
  }));

  const drawdownData = result.equityCurve.map((e) => ({
    x: new Date(e.timestamp).toISOString().split("T")[0],
    y: e.drawdown * 100,
  }));

  // Calculate monthly returns
  const monthlyReturns = calculateMonthlyReturns(result.equityCurve);

  return `
    <script>
        // Equity Curve Chart
        const equityCtx = document.getElementById('equityChart').getContext('2d');
        new Chart(equityCtx, {
            type: 'line',
            data: {
                labels: ${JSON.stringify(equityData.map((d) => d.x))},
                datasets: [{
                    label: 'Portfolio Value',
                    data: ${JSON.stringify(equityData.map((d) => d.y))},
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return '$' + context.parsed.y.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Date'
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Portfolio Value ($)'
                        }
                    }
                }
            }
        });

        // Drawdown Chart
        const drawdownCtx = document.getElementById('drawdownChart').getContext('2d');
        new Chart(drawdownCtx, {
            type: 'line',
            data: {
                labels: ${JSON.stringify(drawdownData.map((d) => d.x))},
                datasets: [{
                    label: 'Drawdown %',
                    data: ${JSON.stringify(drawdownData.map((d) => d.y))},
                    borderColor: '#e74c3c',
                    backgroundColor: 'rgba(231, 76, 60, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.parsed.y.toFixed(2) + '%';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Date'
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Drawdown (%)'
                        },
                        reverse: true
                    }
                }
            }
        });

        // Monthly Returns Chart
        const monthlyCtx = document.getElementById('monthlyReturnsChart').getContext('2d');
        new Chart(monthlyCtx, {
            type: 'bar',
            data: {
                labels: ${JSON.stringify(monthlyReturns.map((r) => r.month))},
                datasets: [{
                    label: 'Monthly Return %',
                    data: ${JSON.stringify(monthlyReturns.map((r) => r.return * 100))},
                    backgroundColor: ${JSON.stringify(monthlyReturns.map((r) => r.return >= 0 ? 'rgba(39, 174, 96, 0.7)' : 'rgba(231, 76, 60, 0.7)'))},
                    borderColor: ${JSON.stringify(monthlyReturns.map((r) => r.return >= 0 ? '#27ae60' : '#e74c3c'))},
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.parsed.y.toFixed(2) + '%';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Month'
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Return (%)'
                        }
                    }
                }
            }
        });
    </script>`;
}

function generateSummarySection(result: BacktestResult, theme: string): string {
  const m = result.metrics;
  const trades = result.trades.filter(t => t.pnl !== undefined);
  
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
                        <div style="font-size: 1.4em; font-weight: 600; color: ${m.expectancy >= 0 ? '#27ae60' : '#e74c3c'};">$${m.expectancy.toFixed(2)}</div>
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
  equityCurve: { timestamp: number; equity: number; drawdown: number }[]
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
  options: Partial<ReportOptions> = {}
): Promise<void> {
  const fs = await import("fs");
  const html = generateHTMLReport(result, data, options);
  fs.writeFileSync(outputPath, html, "utf-8");
}

export default { generateHTMLReport, saveHTMLReport };
