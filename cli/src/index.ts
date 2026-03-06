#!/usr/bin/env node

import { Command } from "commander";
import { readFileSync, readdirSync } from "fs";
import { dataFeed } from "@pinescript-utils/data-feed";
import { pineRuntime } from "@pinescript-utils/pine-runtime";
import { BacktestEngine } from "@pinescript-utils/backtester";
import { saveHTMLReport } from "@pinescript-utils/reporter";
import { StrategyRanker } from "@pinescript-utils/ranker";
import type { StrategyDefinition } from "@pinescript-utils/ranker";
import { StrategyOptimizer } from "@pinescript-utils/optimizer";
import type { OptimizationObjective } from "@pinescript-utils/optimizer";
import { WalkForwardAnalyzer } from "@pinescript-utils/walk-forward";
import {
  formatCurrency,
  formatPercent,
  type OHLCV,
  type RiskManagementConfig,
} from "@pinescript-utils/core";
import { resolve } from "path";
import { ArenaEngine } from "@pinescript-utils/llm-arena";
import { MonteCarloSimulator } from "@pinescript-utils/monte-carlo";

const VENICE_MODELS = ["kimi-k2-thinking", "zai-org-glm-4.7", "grok-41-fast"];

const program = new Command();

program
  .name("pinescript-utils")
  .description(
    "TypeScript-based testing and development utility suite for PineScript strategies",
  )
  .version("1.0.0");

program
  .command("backtest")
  .description("Backtest a PineScript strategy against historical data")
  .requiredOption("-s, --strategy <path>", "Path to PineScript file")
  .requiredOption("-a, --asset <symbol>", "Asset symbol (e.g., AAPL, BTC-USD)")
  .option(
    "-t, --timeframe <tf>",
    "Timeframe (1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w, 1M)",
    "1d",
  )
  .option("-f, --from <date>", "Start date (YYYY-MM-DD)", "2020-01-01")
  .option(
    "-e, --to <date>",
    "End date (YYYY-MM-DD)",
    new Date().toISOString().split("T")[0],
  )
  .option("-c, --capital <amount>", "Initial capital", "10000")
  .option("-o, --output <path>", "Output HTML report path")
  .option("--mock", "Use mock data instead of fetching from API")
  .option("--stop-loss <pct>", "Fixed stop-loss percentage (e.g., 0.05 = 5%)")
  .option("--stop-loss-atr <mult>", "ATR-based stop-loss multiplier")
  .option(
    "--take-profit <pct>",
    "Fixed take-profit percentage (e.g., 0.10 = 10%)",
  )
  .option("--take-profit-rr <ratio>", "Risk-reward take-profit ratio")
  .option("--trailing-stop <pct>", "Fixed trailing stop percentage")
  .option("--trailing-stop-atr <mult>", "ATR-based trailing stop multiplier")
  .option(
    "--position-sizing <type>",
    "Position sizing strategy (fixed-fractional, kelly, atr-based)",
  )
  .option(
    "--risk-fraction <value>",
    "Risk fraction for position sizing (e.g., 0.02 = 2%)",
  )
  .option(
    "--monte-carlo [sims]",
    "Run Monte Carlo simulation after backtest (default: 1000 sims)",
  )
  .action(async (options) => {
    try {
      console.log("🚀 PineScript Utils - Backtest");
      console.log("==============================");
      console.log();

      // Load strategy
      console.log(`📄 Loading strategy from ${options.strategy}...`);
      const strategyScript = readFileSync(options.strategy, "utf-8");
      const strategyName =
        options.strategy.split("/").pop()?.replace(".pine", "") || "Strategy";
      console.log("✅ Strategy loaded");
      console.log();

      // Validate strategy
      console.log("🔍 Validating strategy...");
      const validation = pineRuntime.validateScript(strategyScript);
      if (!validation.valid) {
        console.error("❌ Strategy validation failed:");
        validation.errors.forEach((err) => {
          console.error(`   Line ${err.line}: ${err.message}`);
        });
        process.exit(1);
      }
      if (validation.warnings.length > 0) {
        console.log("⚠️  Warnings:");
        validation.warnings.forEach((warn) => {
          console.log(`   Line ${warn.line}: ${warn.message}`);
        });
      }
      console.log("✅ Strategy validated");
      console.log();

      // Fetch data
      let data: OHLCV[];
      if (options.mock) {
        console.log("📊 Generating mock data...");
        data = dataFeed.getMockData("random", 252, 100);
      } else {
        console.log(`📊 Fetching historical data for ${options.asset}...`);
        data = await dataFeed.fetchHistorical(
          options.asset,
          options.timeframe,
          new Date(options.from),
          new Date(options.to),
        );
      }
      console.log(`✅ Loaded ${data.length} data points`);
      console.log(
        `   Date range: ${new Date(data[0].timestamp).toLocaleDateString()} to ${new Date(data[data.length - 1].timestamp).toLocaleDateString()}`,
      );
      console.log(
        `   Price range: ${data.reduce((min, d) => Math.min(min, d.low), Infinity).toFixed(2)} - ${data.reduce((max, d) => Math.max(max, d.high), -Infinity).toFixed(2)}`,
      );
      console.log();

      // Execute strategy
      console.log("⚙️  Executing strategy...");
      const initialCapital = parseFloat(options.capital);
      const signals = await pineRuntime.executeStrategy(
        strategyScript,
        data,
        initialCapital,
      );
      console.log(`✅ Generated ${signals.length} signals`);
      console.log();

      // Build risk management config from CLI flags
      const riskManagement = buildRiskManagementConfig(options);

      // Run backtest with proper engine
      console.log("💰 Running backtest simulation...");
      const engineConfig: any = { initialCapital };
      if (riskManagement) {
        engineConfig.riskManagement = riskManagement;
        console.log("   Risk management enabled:");
        if (riskManagement.stopLoss)
          console.log(
            `     Stop-loss: ${riskManagement.stopLoss.type} (${riskManagement.stopLoss.value})`,
          );
        if (riskManagement.takeProfit)
          console.log(
            `     Take-profit: ${riskManagement.takeProfit.type} (${riskManagement.takeProfit.value})`,
          );
        if (riskManagement.trailingStop)
          console.log(
            `     Trailing stop: ${riskManagement.trailingStop.type} (${riskManagement.trailingStop.value})`,
          );
        if (riskManagement.positionSizing)
          console.log(
            `     Position sizing: ${riskManagement.positionSizing.type} (${riskManagement.positionSizing.value})`,
          );
      }
      const engine = new BacktestEngine(engineConfig);
      const result = await engine.run(signals, data, options.asset);
      console.log(`✅ Completed ${result.trades.length} trades`);
      console.log();

      // Display results
      const metrics = result.metrics;
      console.log("📊 Backtest Results");
      console.log("==================");
      console.log();
      console.log("Capital:");
      console.log(`  Initial:    ${formatCurrency(result.initialCapital)}`);
      console.log(`  Final:      ${formatCurrency(result.finalCapital)}`);
      console.log(`  Return:     ${formatPercent(metrics.totalReturn)}`);
      console.log();
      console.log("Performance Metrics:");
      console.log(`  Total Trades:      ${metrics.totalTrades}`);
      console.log(`  Win Rate:          ${formatPercent(metrics.winRate)}`);
      console.log(`  Profit Factor:     ${metrics.profitFactor.toFixed(2)}`);
      console.log(`  Sharpe Ratio:      ${metrics.sharpeRatio.toFixed(2)}`);
      console.log(`  Sortino Ratio:     ${metrics.sortinoRatio.toFixed(2)}`);
      console.log(`  Max Drawdown:      ${formatPercent(metrics.maxDrawdown)}`);
      console.log(`  Volatility:        ${formatPercent(metrics.volatility)}`);
      console.log();
      console.log("Trade Statistics:");
      console.log(`  Average Win:       ${formatCurrency(metrics.averageWin)}`);
      console.log(
        `  Average Loss:      ${formatCurrency(metrics.averageLoss)}`,
      );
      console.log(`  Expectancy:        ${formatCurrency(metrics.expectancy)}`);
      console.log(
        `  Average Trade:     ${formatCurrency(metrics.averageTrade)}`,
      );
      console.log();

      // Show recent trades
      const closingTrades = result.trades.filter((t) => t.pnl !== undefined);
      if (closingTrades.length > 0) {
        console.log("Recent Trades:");
        console.log("  Time                 Action    Price       P&L");
        console.log("  " + "-".repeat(55));
        closingTrades.slice(-5).forEach((trade) => {
          const time = new Date(trade.timestamp).toLocaleString();
          const pnlStr =
            trade.pnl !== undefined ? formatCurrency(trade.pnl) : "";
          console.log(
            `  ${time}  ${trade.action.toUpperCase().padEnd(6)}  ${trade.price.toFixed(2).padStart(8)}  ${pnlStr}`,
          );
        });
        console.log();
      }

      // Generate HTML report if output path provided
      if (options.output) {
        console.log(`📝 Generating HTML report: ${options.output}...`);
        await saveHTMLReport(result, data, options.output, {
          title: `${strategyName} Backtest Report`,
          strategyName,
          symbol: options.asset,
          timeframe: options.timeframe,
        });
        console.log("✅ Report saved");
        console.log();
      }

      // Run Monte Carlo if requested
      if (options.monteCarlo !== undefined) {
        const simCount =
          options.monteCarlo === true
            ? 1000
            : parseInt(options.monteCarlo as string) || 1000;
        console.log(
          `🎲 Running Monte Carlo simulation (${simCount} simulations)...`,
        );
        const mcSim = new MonteCarloSimulator({
          simulations: simCount,
          seed: 42,
        });
        const mcResult = mcSim.simulate(result);
        console.log();
        console.log(mcSim.formatSummary(mcResult));
        console.log();
      }

      console.log("✨ Backtest complete!");
    } catch (error) {
      console.error("❌ Error:", error);
      process.exit(1);
    }
  });

program
  .command("rank")
  .description("Rank multiple PineScript strategies against the same data")
  .requiredOption(
    "-d, --directory <path>",
    "Directory containing .pine strategy files",
  )
  .requiredOption("-a, --asset <symbol>", "Asset symbol")
  .option("-t, --timeframe <tf>", "Timeframe", "1d")
  .option("-f, --from <date>", "Start date", "2020-01-01")
  .option("-e, --to <date>", "End date", new Date().toISOString().split("T")[0])
  .option("-c, --capital <amount>", "Initial capital", "10000")
  .option("--mock", "Use mock data")
  .option("--min-trades <number>", "Minimum trades required", "5")
  .action(async (options) => {
    try {
      console.log("🏆 PineScript Utils - Strategy Ranking");
      console.log("======================================");
      console.log();

      // Load all strategies from directory
      console.log(`📂 Loading strategies from ${options.directory}...`);
      const strategies: StrategyDefinition[] = [];

      const files = readdirSync(options.directory).filter((f) =>
        f.endsWith(".pine"),
      );

      console.log(`Found ${files.length} strategy files`);
      console.log();

      // Fetch data once for all strategies
      let data: OHLCV[];
      if (options.mock) {
        console.log("📊 Generating mock data...");
        data = dataFeed.getMockData("random", 252, 100);
      } else {
        console.log(`📊 Fetching historical data for ${options.asset}...`);
        data = await dataFeed.fetchHistorical(
          options.asset,
          options.timeframe,
          new Date(options.from),
          new Date(options.to),
        );
      }
      console.log(`✅ Loaded ${data.length} data points`);
      console.log();

      // Process each strategy
      console.log("⚙️  Processing strategies...");
      for (const file of files) {
        try {
          const strategyPath = resolve(options.directory, file);
          const strategyScript = readFileSync(strategyPath, "utf-8");
          const strategyName = file.replace(".pine", "");

          const signals = await pineRuntime.executeStrategy(
            strategyScript,
            data,
            parseFloat(options.capital),
          );

          strategies.push({
            name: strategyName,
            description: `${strategyName} strategy`,
            signals,
          });

          console.log(`  ✅ ${strategyName} - ${signals.length} signals`);
        } catch (error) {
          console.log(`  ❌ ${file} - failed to parse`);
        }
      }
      console.log();

      if (strategies.length === 0) {
        console.error("❌ No valid strategies found");
        process.exit(1);
      }

      // Rank strategies
      console.log("🏆 Ranking strategies...");
      console.log();

      const ranker = new StrategyRanker({
        minTrades: parseInt(options.minTrades),
      });

      const results = await ranker.rankStrategies(
        strategies,
        data,
        options.asset,
      );

      // Display results
      console.log(ranker.generateSummary(results));
      console.log();
      console.log(ranker.generateComparisonTable(results));
      console.log();

      console.log("✨ Ranking complete!");
    } catch (error) {
      console.error("❌ Error:", error);
      process.exit(1);
    }
  });

program
  .command("fetch-data")
  .description("Fetch historical market data")
  .requiredOption("-a, --asset <symbol>", "Asset symbol")
  .option("-t, --timeframe <tf>", "Timeframe", "1d")
  .option("-f, --from <date>", "Start date", "2023-01-01")
  .option("-e, --to <date>", "End date")
  .action(async (options) => {
    try {
      console.log("📊 Fetching data...");

      const end = options.to ? new Date(options.to) : new Date();
      const data = await dataFeed.fetchHistorical(
        options.asset,
        options.timeframe,
        new Date(options.from),
        end,
      );

      console.log(`✅ Fetched ${data.length} data points`);
      console.log();
      console.log("Recent data:");
      console.log("  Date        Open      High       Low     Close    Volume");
      console.log("  " + "-".repeat(60));
      data.slice(-5).forEach((d) => {
        const date = new Date(d.timestamp).toLocaleDateString();
        console.log(
          `  ${date}  ${d.open.toFixed(2).padStart(8)}  ${d.high.toFixed(2).padStart(8)}  ${d.low.toFixed(2).padStart(8)}  ${d.close.toFixed(2).padStart(8)}  ${d.volume.toLocaleString()}`,
        );
      });
    } catch (error) {
      console.error("❌ Error:", error);
      process.exit(1);
    }
  });

program
  .command("optimize")
  .description("Optimize strategy parameters via grid search")
  .requiredOption("-s, --strategy <path>", "Path to PineScript file")
  .requiredOption("-a, --asset <symbol>", "Asset symbol")
  .option("-t, --timeframe <tf>", "Timeframe", "1d")
  .option("-f, --from <date>", "Start date", "2020-01-01")
  .option("-e, --to <date>", "End date", new Date().toISOString().split("T")[0])
  .option("-c, --capital <amount>", "Initial capital", "10000")
  .option(
    "-o, --objective <metric>",
    "Optimization objective (sharpe, sortino, return, winRate, profitFactor, calmar, expectancy)",
    "sharpe",
  )
  .option("--min-trades <number>", "Minimum trades required", "3")
  .option("--top <number>", "Show top N results", "10")
  .option("--mock", "Use mock data")
  .action(async (options) => {
    try {
      console.log("🔧 PineScript Utils - Parameter Optimizer");
      console.log("==========================================");
      console.log();

      // Load strategy
      console.log(`📄 Loading strategy from ${options.strategy}...`);
      const strategyScript = readFileSync(options.strategy, "utf-8");
      console.log("✅ Strategy loaded");
      console.log();

      // Extract parameters
      const optimizer = new StrategyOptimizer();
      const ranges = optimizer.getParameterRanges(strategyScript);
      if (ranges.length === 0) {
        console.error(
          "❌ No input() parameters found in strategy. Nothing to optimize.",
        );
        process.exit(1);
      }

      console.log("📋 Parameters to optimize:");
      for (const r of ranges) {
        console.log(`  ${r.name}: ${r.min} → ${r.max} (step ${r.step})`);
      }
      const totalCombos = ranges.reduce(
        (acc, r) => acc * Math.ceil((r.max - r.min) / r.step + 1),
        1,
      );
      console.log(`  Total combinations: ${totalCombos}`);
      console.log();

      // Fetch data
      let data: OHLCV[];
      if (options.mock) {
        console.log("📊 Generating mock data...");
        data = dataFeed.getMockData("random", 252, 100);
      } else {
        console.log(`📊 Fetching historical data for ${options.asset}...`);
        data = await dataFeed.fetchHistorical(
          options.asset,
          options.timeframe,
          new Date(options.from),
          new Date(options.to),
        );
      }
      console.log(`✅ Loaded ${data.length} data points`);
      console.log();

      // Run optimization
      console.log(`⚙️  Optimizing for: ${options.objective}`);
      console.log("   Running...");

      const result = await optimizer.optimize(
        strategyScript,
        data,
        options.asset,
        {
          objective: options.objective as OptimizationObjective,
          minTrades: parseInt(options.minTrades),
          initialCapital: parseFloat(options.capital),
          onProgress: (done, total, best) => {
            if (done % 50 === 0 || done === total) {
              const pct = ((done / total) * 100).toFixed(1);
              const bestStr = best
                ? ` | Best score: ${best.score.toFixed(3)}`
                : "";
              process.stdout.write(
                `\r   ${done}/${total} (${pct}%)${bestStr}   `,
              );
            }
          },
        },
      );
      console.log();
      console.log();

      // Display results
      console.log(optimizer.formatSummary(result));
      console.log();
      console.log(optimizer.formatResultsTable(result, parseInt(options.top)));
      console.log();

      console.log("✨ Optimization complete!");
    } catch (error) {
      console.error("❌ Error:", error);
      process.exit(1);
    }
  });

program
  .command("walk-forward")
  .description("Run walk-forward analysis to validate parameter optimization")
  .requiredOption("-s, --strategy <path>", "Path to PineScript file")
  .requiredOption("-a, --asset <symbol>", "Asset symbol")
  .option("-t, --timeframe <tf>", "Timeframe", "1d")
  .option("-f, --from <date>", "Start date", "2020-01-01")
  .option("-e, --to <date>", "End date", new Date().toISOString().split("T")[0])
  .option("-c, --capital <amount>", "Initial capital", "10000")
  .option("-w, --windows <number>", "Number of walk-forward windows", "5")
  .option("--train-ratio <ratio>", "Train/test split ratio", "0.7")
  .option("-o, --objective <metric>", "Optimization objective", "sharpe")
  .option("--min-trades <number>", "Minimum trades required", "3")
  .option("--mock", "Use mock data")
  .action(async (options) => {
    try {
      console.log("🔄 PineScript Utils - Walk-Forward Analysis");
      console.log("============================================");
      console.log();

      // Load strategy
      console.log(`📄 Loading strategy from ${options.strategy}...`);
      const strategyScript = readFileSync(options.strategy, "utf-8");
      console.log("✅ Strategy loaded");
      console.log();

      // Fetch data
      let data: OHLCV[];
      if (options.mock) {
        console.log("📊 Generating mock data...");
        data = dataFeed.getMockData("random", 500, 100);
      } else {
        console.log(`📊 Fetching historical data for ${options.asset}...`);
        data = await dataFeed.fetchHistorical(
          options.asset,
          options.timeframe,
          new Date(options.from),
          new Date(options.to),
        );
      }
      console.log(`✅ Loaded ${data.length} data points`);
      console.log();

      // Run walk-forward
      const analyzer = new WalkForwardAnalyzer();
      const numWindows = parseInt(options.windows);

      console.log(`⚙️  Running ${numWindows}-window walk-forward analysis...`);
      console.log(
        `   Train/Test split: ${(parseFloat(options.trainRatio) * 100).toFixed(0)}% / ${((1 - parseFloat(options.trainRatio)) * 100).toFixed(0)}%`,
      );
      console.log(`   Objective: ${options.objective}`);
      console.log();

      const result = await analyzer.analyze(
        strategyScript,
        data,
        options.asset,
        {
          windows: numWindows,
          trainRatio: parseFloat(options.trainRatio),
          objective: options.objective as OptimizationObjective,
          minTrades: parseInt(options.minTrades),
          initialCapital: parseFloat(options.capital),
          onProgress: (w, total, phase) => {
            process.stdout.write(`\r   Window ${w}/${total}: ${phase}...   `);
          },
        },
      );
      console.log();
      console.log();

      // Display results
      console.log(analyzer.formatSummary(result));
      console.log();
      console.log(analyzer.formatWindowsTable(result));
      console.log();

      console.log("✨ Walk-forward analysis complete!");
    } catch (error) {
      console.error("❌ Error:", error);
      process.exit(1);
    }
  });

program
  .command("arena-tournament")
  .description("Run LLM Arena tournament with all models")
  .requiredOption("-a, --asset <symbol>", "Asset symbol")
  .option("-c, --capital <amount>", "Initial capital", "10000")
  .option("-t, --timeframe <tf>", "Timeframe", "1d")
  .option("-f, --from <date>", "Start date", "2023-01-01")
  .option("-e, --to <date>", "End date")
  .option("-r, --rounds <number>", "Number of rounds", "1")
  .option("--mock", "Use mock data")
  .option(
    "--test-mode",
    "Use sample strategies instead of calling LLM API (for testing)",
  )
  .option("-v, --verbose", "Show detailed generation errors")
  .action(async (options) => {
    try {
      console.log("🤖 PineScript Utils - LLM Arena Tournament");
      console.log("==========================================");
      console.log();

      // Check for Venice API key (unless in test mode)
      if (!options.testMode && !process.env.VENICE_API_KEY) {
        console.error("❌ VENICE_API_KEY environment variable is required");
        console.error("   Get a key from https://venice.ai");
        console.error("   Or use --test-mode to run with sample strategies");
        process.exit(1);
      }

      // Sample strategies for test mode
      const SAMPLE_STRATEGIES: Record<string, string> = {
        "kimi-k2-thinking": `//@version=5
strategy("Kimi SMA Crossover", overlay=true)
fastLength = input.int(10, title="Fast SMA Length")
slowLength = input.int(30, title="Slow SMA Length")
fastSMA = ta.sma(close, fastLength)
slowSMA = ta.sma(close, slowLength)
if (ta.crossover(fastSMA, slowSMA))
    strategy.entry("Long", strategy.long)
if (ta.crossunder(fastSMA, slowSMA))
    strategy.close("Long")`,
        "zai-org-glm-4.7": `//@version=5
strategy("GLM RSI Strategy", overlay=true)
rsiLength = input.int(14, title="RSI Length")
overbought = input.int(70, title="Overbought Level")
oversold = input.int(30, title="Oversold Level")
rsiValue = ta.rsi(close, rsiLength)
if (ta.crossunder(rsiValue, oversold))
    strategy.entry("Long", strategy.long)
if (ta.crossover(rsiValue, overbought))
    strategy.close("Long")`,
        "grok-41-fast": `//@version=5
strategy("Grok EMA Strategy", overlay=true)
emaLength = input.int(20, title="EMA Length")
emaValue = ta.ema(close, emaLength)
if (ta.crossover(close, emaValue))
    strategy.entry("Long", strategy.long)
if (ta.crossunder(close, emaValue))
    strategy.close("Long")`,
      };

      const rounds = parseInt(options.rounds);
      console.log(`🎯 Configuration:`);
      console.log(`   Asset: ${options.asset}`);
      console.log(`   Capital: ${formatCurrency(parseFloat(options.capital))}`);
      console.log(`   Rounds: ${rounds}`);
      console.log(`   Models: ${VENICE_MODELS.join(", ")}`);
      if (options.testMode) {
        console.log(`   ⚠️  TEST MODE: Using sample strategies (no LLM calls)`);
      }
      console.log();

      // Fetch data
      let data: OHLCV[];
      if (options.mock) {
        console.log("📊 Generating mock data...");
        data = dataFeed.getMockData("random", 252, 100);
      } else {
        console.log(`📊 Fetching historical data for ${options.asset}...`);
        const end = options.to ? new Date(options.to) : new Date();
        data = await dataFeed.fetchHistorical(
          options.asset,
          options.timeframe,
          new Date(options.from),
          end,
        );
      }
      console.log(`✅ Loaded ${data.length} data points`);
      console.log();

      // Run tournament
      console.log(
        `🏆 Running ${rounds} round(s) with ${VENICE_MODELS.length} models...`,
      );
      console.log("   This may take a few minutes...");
      console.log();

      const engine = new ArenaEngine({
        apiKey: options.testMode ? undefined : process.env.VENICE_API_KEY!,
        models: VENICE_MODELS,
        rounds,
        initialCapital: parseFloat(options.capital),
        testStrategies: options.testMode ? SAMPLE_STRATEGIES : undefined,
        onProgress: (event) => {
          if (event.type === "matchup_done") {
            process.stdout.write(
              `\r   ${event.model1} vs ${event.model2} -> ${event.winner || "TIE"}          `,
            );
          }
        },
      });
      const result = await engine.runTournament(data, options.asset);
      console.log();
      console.log();

      // Check for errors
      const failedModels = result.matchups.flatMap((m) =>
        m.competitors
          .filter((c) => c.error)
          .map((c) => ({ model: c.model, error: c.error })),
      );

      if (failedModels.length > 0) {
        console.log("❌ Generation Failures:");
        console.log("  " + "-".repeat(60));
        const uniqueFailures = [
          ...new Map(failedModels.map((f) => [f.model, f])).values(),
        ];
        uniqueFailures.forEach(({ model, error }) => {
          console.log(`  ${model}:`);
          const errorMsg = error || "Unknown error";
          if (options.verbose) {
            console.log(`    ${errorMsg}`);
          } else {
            console.log(
              `    ${errorMsg.substring(0, 80)}${errorMsg.length > 80 ? "..." : ""}`,
            );
          }
        });
        console.log();
        console.log("💡 Tip: Use --verbose to see full error messages");
        console.log("💡 Tip: Ensure VENICE_API_KEY is set correctly");
        console.log();
      }

      // Display results
      console.log("📊 Tournament Results");
      console.log("=====================");
      console.log();
      console.log("Final Standings:");
      console.log(
        "  Rank  Model               Elo    Wins  Losses  Ties  Avg Return  Avg Sharpe  Avg Trades",
      );
      console.log("  " + "-".repeat(90));

      result.standings
        .sort((a, b) => b.elo - a.elo)
        .forEach((standing, i) => {
          const rank = (i + 1).toString().padStart(2);
          const model = standing.model.padEnd(18);
          const elo = Math.round(standing.elo).toString().padStart(5);
          const wins = standing.wins.toString().padStart(4);
          const losses = standing.losses.toString().padStart(5);
          const ties = standing.ties.toString().padStart(4);
          const avgReturn = formatPercent(standing.avgReturn).padStart(10);
          const avgSharpe = standing.avgSharpe.toFixed(2).padStart(10);
          const avgTrades = standing.avgTrades.toFixed(1).padStart(10);

          console.log(
            `  ${rank}    ${model} ${elo}  ${wins}  ${losses}   ${ties}  ${avgReturn}  ${avgSharpe}  ${avgTrades}`,
          );
        });
      console.log();

      // Show detailed matchups with scores
      console.log("Match Results:");
      console.log(
        "  Round  Competitor 1         Score  vs  Score  Competitor 2         Winner",
      );
      console.log("  " + "-".repeat(80));
      result.matchups.forEach((match, idx) => {
        const c1 = match.competitors[0];
        const c2 = match.competitors[1] || match.competitors[0];
        const c1Name = (c1?.model || "?").substring(0, 18).padEnd(18);
        const c2Name = (c2?.model || "?").substring(0, 18).padEnd(18);
        const c1Score = (c1?.score ?? 0).toFixed(2).padStart(6);
        const c2Score = (c2?.score ?? 0).toFixed(2).padStart(6);
        const winner = (match.winner || "TIE").substring(0, 10).padEnd(10);
        console.log(
          `  ${(idx + 1).toString().padStart(2)}     ${c1Name} ${c1Score}  vs  ${c2Score}  ${c2Name} ${winner}`,
        );
      });
      console.log();

      // Show sample strategy if verbose
      if (options.verbose && result.matchups.length > 0) {
        const firstMatch = result.matchups[0];
        const firstCompetitor = firstMatch.competitors[0];
        if (firstCompetitor?.generatedCode) {
          console.log("📄 Sample Generated Strategy (first match):");
          console.log("  " + "-".repeat(60));
          console.log(
            firstCompetitor.generatedCode.split("\n").slice(0, 20).join("\n"),
          );
          console.log("  ...");
          console.log();
        }
      }

      console.log(`⏱️  Time elapsed: ${(result.elapsedMs / 1000).toFixed(1)}s`);
      console.log();
      console.log("✨ Tournament complete!");
    } catch (error) {
      console.error("\n❌ Error:", error);
      process.exit(1);
    }
  });

program
  .command("monte-carlo")
  .description("Run Monte Carlo simulation on a backtest to test robustness")
  .requiredOption("-s, --strategy <path>", "Path to PineScript file")
  .requiredOption("-a, --asset <symbol>", "Asset symbol")
  .option("-t, --timeframe <tf>", "Timeframe", "1d")
  .option("-f, --from <date>", "Start date", "2020-01-01")
  .option("-e, --to <date>", "End date", new Date().toISOString().split("T")[0])
  .option("-c, --capital <amount>", "Initial capital", "10000")
  .option("--mock", "Use mock data")
  .option("--simulations <number>", "Number of Monte Carlo simulations", "1000")
  .option(
    "--ruin-threshold <pct>",
    "Ruin threshold as fraction of capital",
    "0.5",
  )
  .option("--seed <number>", "Random seed for reproducibility", "42")
  .option("--stop-loss <pct>", "Fixed stop-loss percentage")
  .option("--stop-loss-atr <mult>", "ATR-based stop-loss multiplier")
  .option("--take-profit <pct>", "Fixed take-profit percentage")
  .option("--take-profit-rr <ratio>", "Risk-reward take-profit ratio")
  .option("--trailing-stop <pct>", "Fixed trailing stop percentage")
  .option("--trailing-stop-atr <mult>", "ATR-based trailing stop multiplier")
  .option("--position-sizing <type>", "Position sizing strategy")
  .option("--risk-fraction <value>", "Risk fraction for position sizing")
  .action(async (options) => {
    try {
      console.log("🎲 PineScript Utils - Monte Carlo Simulation");
      console.log("=============================================");
      console.log();

      // Load strategy
      console.log(`📄 Loading strategy from ${options.strategy}...`);
      const strategyScript = readFileSync(options.strategy, "utf-8");
      console.log("✅ Strategy loaded");
      console.log();

      // Fetch data
      let data: OHLCV[];
      if (options.mock) {
        console.log("📊 Generating mock data...");
        data = dataFeed.getMockData("random", 252, 100);
      } else {
        console.log(`📊 Fetching historical data for ${options.asset}...`);
        data = await dataFeed.fetchHistorical(
          options.asset,
          options.timeframe,
          new Date(options.from),
          new Date(options.to),
        );
      }
      console.log(`✅ Loaded ${data.length} data points`);
      console.log();

      // Execute strategy
      console.log("⚙️  Executing strategy...");
      const initialCapital = parseFloat(options.capital);
      const signals = await pineRuntime.executeStrategy(
        strategyScript,
        data,
        initialCapital,
      );
      console.log(`✅ Generated ${signals.length} signals`);
      console.log();

      // Build risk management config
      const riskManagement = buildRiskManagementConfig(options);

      // Run backtest first
      console.log("💰 Running backtest...");
      const engineConfig: any = { initialCapital };
      if (riskManagement) engineConfig.riskManagement = riskManagement;
      const engine = new BacktestEngine(engineConfig);
      const backtestResult = await engine.run(signals, data, options.asset);
      console.log(
        `✅ Backtest complete: ${backtestResult.trades.length} trades, ${formatPercent(backtestResult.metrics.totalReturn)} return`,
      );
      console.log();

      // Run Monte Carlo
      const simCount = parseInt(options.simulations);
      const ruinThreshold = parseFloat(options.ruinThreshold);
      const seed = parseInt(options.seed);

      console.log(`🎲 Running ${simCount} Monte Carlo simulations...`);
      console.log(
        `   Ruin threshold: ${(ruinThreshold * 100).toFixed(0)}% of capital`,
      );
      console.log(`   Seed: ${seed}`);

      const mcSim = new MonteCarloSimulator({
        simulations: simCount,
        ruinThreshold,
        seed,
        onProgress: (done, total) => {
          if (done % 200 === 0 || done === total) {
            process.stdout.write(`\r   ${done}/${total} simulations...   `);
          }
        },
      });

      const mcResult = mcSim.simulate(backtestResult);
      console.log();
      console.log();
      console.log(mcSim.formatSummary(mcResult));
      console.log();
      console.log("✨ Monte Carlo simulation complete!");
    } catch (error) {
      console.error("❌ Error:", error);
      process.exit(1);
    }
  });

/**
 * Build RiskManagementConfig from CLI options
 */
function buildRiskManagementConfig(
  options: any,
): RiskManagementConfig | undefined {
  const config: RiskManagementConfig = {};
  let hasConfig = false;

  if (options.stopLoss) {
    config.stopLoss = { type: "fixed", value: parseFloat(options.stopLoss) };
    hasConfig = true;
  } else if (options.stopLossAtr) {
    config.stopLoss = { type: "atr", value: parseFloat(options.stopLossAtr) };
    hasConfig = true;
  }

  if (options.takeProfit) {
    config.takeProfit = {
      type: "fixed",
      value: parseFloat(options.takeProfit),
    };
    hasConfig = true;
  } else if (options.takeProfitRr) {
    config.takeProfit = {
      type: "risk-reward",
      value: parseFloat(options.takeProfitRr),
    };
    hasConfig = true;
  }

  if (options.trailingStop) {
    config.trailingStop = {
      type: "fixed",
      value: parseFloat(options.trailingStop),
    };
    hasConfig = true;
  } else if (options.trailingStopAtr) {
    config.trailingStop = {
      type: "atr",
      value: parseFloat(options.trailingStopAtr),
    };
    hasConfig = true;
  }

  if (options.positionSizing) {
    const value = parseFloat(options.riskFraction || "0.02");
    config.positionSizing = { type: options.positionSizing, value };
    hasConfig = true;
  }

  return hasConfig ? config : undefined;
}

program.parse();
