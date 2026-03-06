import type { OHLCV, Timeframe, Asset } from "@pinescript-utils/core";
import WebSocket from "ws";

/**
 * Binance data provider
 * Uses Binance WebSocket API for real-time OHLCV streams
 */
export class BinanceDataProvider {
  private baseUrl = "wss://stream.binance.com:9443/ws";
  private connections: Map<string, WebSocket> = new Map();
  private subscribers: Map<string, Set<(data: OHLCV) => void>> = new Map();

  /**
   * Map timeframe to Binance interval
   */
  private mapTimeframe(timeframe: Timeframe): string {
    const mapping: Record<Timeframe, string> = {
      "1m": "1m",
      "5m": "5m",
      "15m": "15m",
      "30m": "30m",
      "1h": "1h",
      "2h": "2h",
      "4h": "4h",
      "1d": "1d",
      "1w": "1w",
      "1M": "1M",
    };
    return mapping[timeframe] || "1d";
  }

  /**
   * Format symbol for Binance (e.g., BTC-USD -> btcusdt)
   */
  private formatSymbol(symbol: string): string {
    return symbol.replace("-", "").replace("USD", "USDT").toLowerCase();
  }

  /**
   * Subscribe to real-time kline (candlestick) stream
   */
  subscribe(
    symbol: string,
    timeframe: Timeframe,
    callback: (data: OHLCV) => void,
  ): () => void {
    const formattedSymbol = this.formatSymbol(symbol);
    const interval = this.mapTimeframe(timeframe);
    const streamName = `${formattedSymbol}@kline_${interval}`;

    // Initialize subscriber set for this stream
    if (!this.subscribers.has(streamName)) {
      this.subscribers.set(streamName, new Set());
    }

    const subs = this.subscribers.get(streamName)!;
    subs.add(callback);

    // Create connection if it doesn't exist
    if (!this.connections.has(streamName)) {
      const ws = new WebSocket(`${this.baseUrl}/${streamName}`);
      this.connections.set(streamName, ws);

      ws.on("message", (data: WebSocket.Data) => {
        try {
          const payload = JSON.parse(data.toString());
          if (payload.k) {
            const kline = payload.k;
            const ohlcv: OHLCV = {
              timestamp: kline.T, // Start time of this bar
              open: parseFloat(kline.o),
              high: parseFloat(kline.h),
              low: parseFloat(kline.l),
              close: parseFloat(kline.c),
              volume: parseFloat(kline.v),
            };

            // Notify all subscribers
            const currentSubs = this.subscribers.get(streamName);
            if (currentSubs) {
              currentSubs.forEach((cb) => cb(ohlcv));
            }
          }
        } catch (error) {
          console.error(
            `Error parsing Binance websocket data for ${streamName}:`,
            error,
          );
        }
      });

      ws.on("error", (error) => {
        console.error(`Binance websocket error for ${streamName}:`, error);
      });

      ws.on("close", () => {
        this.connections.delete(streamName);
        // Implement simple auto-reconnect if there are still subscribers
        const remainingSubs = this.subscribers.get(streamName);
        if (remainingSubs && remainingSubs.size > 0) {
          console.log(`Reconnecting to ${streamName} in 5s...`);
          setTimeout(() => {
            if (
              this.subscribers.has(streamName) &&
              this.subscribers.get(streamName)!.size > 0
            ) {
              // Trigger a resubscribe by creating a dummy sub then un-subbing
              const resub = this.subscribe(symbol, timeframe, () => {});
              resub();
            }
          }, 5000);
        }
      });
    }

    // Return unsubscribe function
    return () => {
      const currentSubs = this.subscribers.get(streamName);
      if (currentSubs) {
        currentSubs.delete(callback);

        // If no more subscribers, close connection
        if (currentSubs.size === 0) {
          this.subscribers.delete(streamName);
          const ws = this.connections.get(streamName);
          if (ws) {
            ws.close();
            this.connections.delete(streamName);
          }
        }
      }
    };
  }
}

/**
 * Yahoo Finance data provider
 * Uses the free Yahoo Finance API
 */
export class YahooFinanceProvider {
  private baseUrl = "https://query1.finance.yahoo.com/v8/finance/chart";

  /**
   * Map timeframe to Yahoo Finance interval
   */
  private mapTimeframe(timeframe: Timeframe): string {
    const mapping: Record<Timeframe, string> = {
      "1m": "1m",
      "5m": "5m",
      "15m": "15m",
      "30m": "30m",
      "1h": "1h",
      "2h": "1h", // Yahoo doesn't have 2h, use 1h
      "4h": "1h", // Yahoo doesn't have 4h, use 1h
      "1d": "1d",
      "1w": "1wk",
      "1M": "1mo",
    };
    return mapping[timeframe] || "1d";
  }

  /**
   * Format symbol for Yahoo Finance
   */
  private formatSymbol(symbol: string): string {
    // Handle crypto pairs (e.g., BTC-USD -> BTC-USD)
    // Handle forex (e.g., EURUSD -> EURUSD=X)
    if (symbol.length === 6 && !symbol.includes("-")) {
      return `${symbol}=X`;
    }
    return symbol.replace("-", "-");
  }

  /**
   * Fetch historical OHLCV data from Yahoo Finance
   */
  async fetchHistorical(
    symbol: string,
    timeframe: Timeframe,
    start: Date,
    end: Date,
  ): Promise<OHLCV[]> {
    const formattedSymbol = this.formatSymbol(symbol);
    const interval = this.mapTimeframe(timeframe);
    const startTimestamp = Math.floor(start.getTime() / 1000);
    const endTimestamp = Math.floor(end.getTime() / 1000);

    const url = `${this.baseUrl}/${formattedSymbol}?interval=${interval}&period1=${startTimestamp}&period2=${endTimestamp}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await response.json();

      if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
        throw new Error("No data available for this symbol/timeframe");
      }

      const result = data.chart.result[0];
      const timestamps: number[] = result.timestamp;
      const quotes = result.indicators.quote[0];
      const opens: number[] = quotes.open;
      const highs: number[] = quotes.high;
      const lows: number[] = quotes.low;
      const closes: number[] = quotes.close;
      const volumes: number[] = quotes.volume;

      const ohlcv: OHLCV[] = [];

      for (let i = 0; i < timestamps.length; i++) {
        if (
          opens[i] !== null &&
          highs[i] !== null &&
          lows[i] !== null &&
          closes[i] !== null
        ) {
          ohlcv.push({
            timestamp: timestamps[i] * 1000, // Convert to milliseconds
            open: opens[i],
            high: highs[i],
            low: lows[i],
            close: closes[i],
            volume: volumes[i] || 0,
          });
        }
      }

      return ohlcv;
    } catch (error) {
      console.error(`Failed to fetch data for ${symbol}:`, error);
      throw error;
    }
  }
}

/**
 * Mock data provider for testing
 * Generates synthetic OHLCV data
 */
export class MockDataProvider {
  /**
   * Generate random walk OHLCV data
   */
  generateRandomWalk(
    startPrice: number,
    count: number,
    volatility: number = 0.02,
  ): OHLCV[] {
    const data: OHLCV[] = [];
    let price = startPrice;
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    for (let i = 0; i < count; i++) {
      const change = (Math.random() - 0.5) * volatility;
      const open = price;
      const close = price * (1 + change);
      const high =
        Math.max(open, close) * (1 + Math.random() * volatility * 0.5);
      const low =
        Math.min(open, close) * (1 - Math.random() * volatility * 0.5);

      data.push({
        timestamp: now - (count - i) * dayMs,
        open,
        high,
        low,
        close,
        volume: Math.floor(Math.random() * 1000000) + 100000,
      });

      price = close;
    }

    return data;
  }

  /**
   * Generate trending data (bull or bear)
   */
  generateTrend(
    startPrice: number,
    count: number,
    trend: number,
    volatility: number = 0.02,
  ): OHLCV[] {
    const data: OHLCV[] = [];
    let price = startPrice;
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    for (let i = 0; i < count; i++) {
      const trendComponent = trend / count;
      const noise = (Math.random() - 0.5) * volatility;
      const change = trendComponent + noise;

      const open = price;
      const close = price * (1 + change);
      const high =
        Math.max(open, close) * (1 + Math.random() * volatility * 0.5);
      const low =
        Math.min(open, close) * (1 - Math.random() * volatility * 0.5);

      data.push({
        timestamp: now - (count - i) * dayMs,
        open,
        high,
        low,
        close,
        volume: Math.floor(Math.random() * 1000000) + 100000,
      });

      price = close;
    }

    return data;
  }
}

/**
 * Main DataFeed class
 * Provides unified interface for fetching market data
 */
export class DataFeed {
  private yahooProvider = new YahooFinanceProvider();
  private mockProvider = new MockDataProvider();
  private binanceProvider = new BinanceDataProvider();

  /**
   * Fetch historical OHLCV data
   * @param symbol Asset symbol (e.g., "AAPL", "BTC-USD", "EURUSD")
   * @param timeframe Time interval (1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w, 1M)
   * @param start Start date
   * @param end End date
   */
  async fetchHistorical(
    symbol: string,
    timeframe: Timeframe,
    start: Date,
    end: Date,
  ): Promise<OHLCV[]> {
    return this.yahooProvider.fetchHistorical(symbol, timeframe, start, end);
  }

  /**
   * Subscribe to real-time OHLCV updates (Binance only for now)
   */
  subscribeRealtime(
    symbol: string,
    timeframe: Timeframe,
    callback: (data: OHLCV) => void,
  ): () => void {
    if (symbol.includes("-USD") || symbol.includes("USDT")) {
      return this.binanceProvider.subscribe(symbol, timeframe, callback);
    }
    throw new Error(
      "Real-time data currently only supported for crypto pairs on Binance",
    );
  }

  /**
   * Get mock data for testing
   */
  getMockData(
    type: "random" | "bull" | "bear",
    count: number = 252,
    startPrice: number = 100,
  ): OHLCV[] {
    switch (type) {
      case "bull":
        return this.mockProvider.generateTrend(startPrice, count, 0.5);
      case "bear":
        return this.mockProvider.generateTrend(startPrice, count, -0.3);
      case "random":
      default:
        return this.mockProvider.generateRandomWalk(startPrice, count);
    }
  }
}

// Export singleton instance
export const dataFeed = new DataFeed();
