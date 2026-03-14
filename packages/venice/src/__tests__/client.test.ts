import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  VeniceClient,
  createVeniceClient,
  VeniceConfig,
  VENICE_MODELS,
  VeniceModel,
} from "../client.js";

// Mock fetch API properly
let mockFetch: ReturnType<typeof vi.fn>;
beforeEach(() => {
  mockFetch = vi.fn();
  global.fetch = mockFetch as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("VeniceClient", () => {
  const mockApiKey = "test-api-key";
  const mockBaseUrl = "https://api.venice.ai/api/v1";
  const mockModel = "test-model";

  describe("constructor", () => {
    it("should initialize with required apiKey", () => {
      const client = new VeniceClient({ apiKey: mockApiKey });
      expect(client).toBeInstanceOf(VeniceClient);
    });

    it("should initialize with custom baseUrl", () => {
      const client = new VeniceClient({
        apiKey: mockApiKey,
        baseUrl: "https://custom.url",
      });
      expect(client).toBeInstanceOf(VeniceClient);
    });

    it("should initialize with custom model", () => {
      const client = new VeniceClient({ apiKey: mockApiKey, model: mockModel });
      expect(client).toBeInstanceOf(VeniceClient);
    });

    it("should remove trailing slashes from baseUrl", () => {
      const client = new VeniceClient({
        apiKey: mockApiKey,
        baseUrl: "https://api.venice.ai/api/v1///",
      });
      expect(client).toBeInstanceOf(VeniceClient);
    });
  });

  describe("createVeniceClient", () => {
    it("should create client from apiKey string", () => {
      const client = createVeniceClient(mockApiKey);
      expect(client).toBeInstanceOf(VeniceClient);
    });

    it("should create client from config object", () => {
      const config: VeniceConfig = {
        apiKey: mockApiKey,
        model: mockModel,
        baseUrl: "https://test.url",
      };
      const client = createVeniceClient(config);
      expect(client).toBeInstanceOf(VeniceClient);
    });

    it("should throw error when no API key provided and no env var", () => {
      // Temporarily delete env var
      const originalEnv = process.env.VENICE_API_KEY;
      delete process.env.VENICE_API_KEY;

      expect(() => createVeniceClient(undefined)).toThrow(
        "No Venice API key provided. Pass one explicitly or set VENICE_API_KEY.",
      );

      // Restore env var
      if (originalEnv) {
        process.env.VENICE_API_KEY = originalEnv;
      }
    });

    it("should create client from VENICE_API_KEY env var", () => {
      const originalEnv = process.env.VENICE_API_KEY;
      process.env.VENICE_API_KEY = mockApiKey;

      const client = createVeniceClient(undefined);
      expect(client).toBeInstanceOf(VeniceClient);

      // Restore original env
      if (originalEnv !== undefined) {
        process.env.VENICE_API_KEY = originalEnv;
      } else {
        delete process.env.VENICE_API_KEY;
      }
    });
  });

  describe("chat method", () => {
    const mockResponse = {
      id: "test-id",
      object: "chat.completion",
      created: 1234567890,
      model: "test-model",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant" as const,
            content: "Test response",
          },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
      },
    };

    it("should send non-streaming chat request", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      });

      const client = new VeniceClient({ apiKey: mockApiKey });
      const messages = [{ role: "user" as const, content: "Hello" }];
      const result = await client.chat(messages, { stream: false });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.venice.ai/api/v1/chat/completions",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${mockApiKey}`,
          },
        }),
      );
      expect(result).toEqual(mockResponse);
    });

    it("should allow overriding model in chat options", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      });

      const client = new VeniceClient({
        apiKey: mockApiKey,
        model: "default-model",
      });
      const messages = [{ role: "user" as const, content: "Hello" }];
      await client.chat(messages, { model: mockModel, stream: false });

      // Check that the request body contains the overridden model
      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.model).toBe(mockModel);
    });

    it("should allow overriding temperature in chat options", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      });

      const client = new VeniceClient({ apiKey: mockApiKey });
      const messages = [{ role: "user" as const, content: "Hello" }];
      await client.chat(messages, { temperature: 0.3, stream: false });

      // Check that the request body contains the overridden temperature
      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.temperature).toBe(0.3);
    });

    it("should allow overriding maxTokens in chat options", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      });

      const client = new VeniceClient({ apiKey: mockApiKey });
      const messages = [{ role: "user" as const, content: "Hello" }];
      await client.chat(messages, { maxTokens: 1000, stream: false });

      // Check that the request body contains the overridden maxTokens (note: API uses max_tokens)
      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.max_tokens).toBe(1000);
    });

    it("should throw error on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => "Unauthorized",
      });

      const client = new VeniceClient({ apiKey: mockApiKey });
      const messages = [{ role: "user" as const, content: "Hello" }];

      await expect(client.chat(messages, { stream: false })).rejects.toThrow(
        "Venice API error 401: Unauthorized",
      );
    });
  });

  describe("prompt method", () => {
    it("should call chat with proper messages", async () => {
      const mockResponse = {
        choices: [
          { message: { role: "assistant" as const, content: "Test response" } },
        ],
      } as any;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      });

      const client = new VeniceClient({ apiKey: mockApiKey });
      const chatSpy = vi
        .spyOn(client, "chat")
        .mockResolvedValueOnce(mockResponse);

      const result = await client.prompt("Test prompt", "System prompt", {
        model: mockModel,
        temperature: 0.5,
      });

      expect(chatSpy).toHaveBeenCalledWith(
        [
          { role: "system" as const, content: "System prompt" },
          { role: "user" as const, content: "Test prompt" },
        ],
        { model: mockModel, temperature: 0.5, stream: false },
      );
      expect(result).toBe("Test response");
    });

    it("should work without system prompt", async () => {
      const mockResponse = {
        choices: [
          { message: { role: "assistant" as const, content: "Test response" } },
        ],
      } as any;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      });

      const client = new VeniceClient({ apiKey: mockApiKey });
      const chatSpy = vi
        .spyOn(client, "chat")
        .mockResolvedValueOnce(mockResponse);

      const result = await client.prompt("Test prompt");

      expect(chatSpy).toHaveBeenCalledWith(
        [{ role: "user" as const, content: "Test prompt" }],
        { stream: false },
      );
      expect(result).toBe("Test response");
    });
  });

  describe("generateStrategy method", () => {
    it("should extract code from markdown code block", async () => {
      const mockResponse = `
        Here's the strategy:
        \`\`\`pinescript
        //@version=5
        strategy("Test")
        // code here
        \`\`\`
      `;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            { message: { role: "assistant" as const, content: mockResponse } },
          ],
        }),
        text: async () =>
          JSON.stringify({
            choices: [
              {
                message: { role: "assistant" as const, content: mockResponse },
              },
            ],
          }),
      });

      const client = new VeniceClient({ apiKey: mockApiKey });
      const result = await client.generateStrategy("Create a simple strategy");

      expect(result).toContain("//@version=5");
      expect(result).toContain('strategy("Test")');
      // Should not contain the markdown code block markers
      expect(result).not.toContain("```");
      expect(result).toContain("// code here");
    });

    it("should return plain response if no code block found", async () => {
      const mockResponse = '//@version=5\nstrategy("Test")\n// code here';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            { message: { role: "assistant" as const, content: mockResponse } },
          ],
        }),
        text: async () =>
          JSON.stringify({
            choices: [
              {
                message: { role: "assistant" as const, content: mockResponse },
              },
            ],
          }),
      });

      const client = new VeniceClient({ apiKey: mockApiKey });
      const result = await client.generateStrategy("Create a simple strategy");

      expect(result).toBe(mockResponse.trim());
    });
  });

  describe("analyseResults method", () => {
    it("should call prompt with strategy code and metrics", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              role: "assistant" as const,
              content: "Analysis complete",
            },
          },
        ],
      } as any;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      });

      const client = new VeniceClient({ apiKey: mockApiKey });
      const promptSpy = vi
        .spyOn(client, "prompt")
        .mockResolvedValueOnce("Analysis complete");

      const strategyCode =
        '//@version=5\nstrategy("Test")\nclose > open ? 1 : 0';
      const metricsJson = '{"netProfit": 1000, "winRate": 0.6}';
      const result = await client.analyseResults(strategyCode, metricsJson, {
        model: mockModel,
      });

      expect(promptSpy).toHaveBeenCalledWith(
        expect.stringContaining(strategyCode),
        expect.stringContaining("You are an expert quantitative analyst"),
        { model: mockModel },
      );
      expect(result).toBe("Analysis complete");
    });
  });

  describe("error handling", () => {
    it("should handle network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const client = new VeniceClient({ apiKey: mockApiKey });
      const messages = [{ role: "user" as const, content: "Hello" }];

      await expect(client.chat(messages, { stream: false })).rejects.toThrow(
        "Network error",
      );
    });

    it("should handle invalid JSON response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error("Invalid JSON");
        },
        text: async () => "Invalid JSON response",
      });

      const client = new VeniceClient({ apiKey: mockApiKey });
      const messages = [{ role: "user" as const, content: "Hello" }];

      await expect(client.chat(messages, { stream: false })).rejects.toThrow(
        "Invalid JSON",
      );
    });
  });

  describe("constants and types", () => {
    it("should export VENICE_MODELS array", () => {
      expect(Array.isArray(VENICE_MODELS)).toBe(true);
      expect(VENICE_MODELS.length).toBeGreaterThan(0);
      expect(VENICE_MODELS).toContain("deepseek-r1-671b");
      expect(VENICE_MODELS).toContain("kimi-k2-thinking");
    });

    it("should have proper type exports", () => {
      // These should not throw if types are properly exported
      expect(typeof VeniceClient).toBe("function");
      expect(typeof createVeniceClient).toBe("function");
      expect(typeof VENICE_MODELS).toBe("object");
    });
  });
});
