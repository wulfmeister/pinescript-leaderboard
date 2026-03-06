import { describe, it, expect } from "vitest";
import { formatDataSourceBadge, getDefaultDataSettings } from "../data-settings";

describe("data-settings", () => {
  describe("getDefaultDataSettings", () => {
    it("returns default settings with mock enabled", () => {
      const settings = getDefaultDataSettings();
      
      expect(settings.timeframe).toBe("1d");
      expect(settings.useMock).toBe(true);
      expect(settings.mockType).toBe("random");
      expect(settings.mockBars).toBe(252);
      expect(settings.from).toBeDefined();
      expect(settings.to).toBeDefined();
    });

    it("returns valid date range", () => {
      const settings = getDefaultDataSettings();
      const fromDate = new Date(settings.from);
      const toDate = new Date(settings.to);
      
      expect(fromDate.getTime()).toBeLessThan(toDate.getTime());
    });
  });

  describe("formatDataSourceBadge", () => {
    it("formats mock data badge correctly", () => {
      const settings: DataSettingsValue = {
        useMock: true,
        mockType: "bull",
        mockBars: 500,
        timeframe: "1d",
        from: "2023-01-01",
        to: "2024-01-01",
      };
      
      const badge = formatDataSourceBadge(settings, "AAPL");
      expect(badge).toBe("500 bars, bull walk");
    });

    it("formats real data badge correctly", () => {
      const settings: DataSettingsValue = {
        useMock: false,
        mockType: "random",
        mockBars: 252,
        timeframe: "1h",
        from: "2023-06-01",
        to: "2024-06-01",
      };
      
      const badge = formatDataSourceBadge(settings, "BTC-USD");
      expect(badge).toContain("BTC-USD");
      expect(badge).toContain("1h");
    });

    it("handles all mock types", () => {
      const types = ["random", "bull", "bear"];
      
      types.forEach(type => {
        const settings = {
          useMock: true,
          mockType: type as any,
          mockBars: 100,
          timeframe: "1d",
          from: "2023-01-01",
          to: "2024-01-01",
        };
        
        const badge = formatDataSourceBadge(settings, "TEST");
        expect(badge).toContain(type);
      });
    });
  });
});
