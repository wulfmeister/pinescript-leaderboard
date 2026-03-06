/**
 * Venice AI LLM client
 *
 * Venice exposes an OpenAI-compatible API at https://api.venice.ai/api/v1
 * so we use the standard chat completions format.
 */

export interface VeniceConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface VeniceStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    delta: Partial<ChatMessage>;
    finish_reason: string | null;
  }[];
}

const DEFAULT_BASE_URL = "https://api.venice.ai/api/v1";
const DEFAULT_MODEL = "deepseek-r1-671b";

/**
 * Available Venice models (subset – full list at docs.venice.ai)
 */
export const VENICE_MODELS = [
  "deepseek-r1-671b",
  "deepseek-v3-0324",
  "llama-3.3-70b",
  "llama-3.1-405b",
  "qwen-2.5-coder-32b",
  "kimi-k2-thinking",
  "zai-org-glm-4.7",
  "grok-41-fast",
] as const;

export type VeniceModel = (typeof VENICE_MODELS)[number];

/**
 * Venice AI client – thin wrapper around the OpenAI-compatible endpoint
 */
export class VeniceClient {
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(config: VeniceConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.model = config.model ?? DEFAULT_MODEL;
  }

  /**
   * Send a chat completion request
   */
  async chat(
    messages: ChatMessage[],
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      stream?: false;
    },
  ): Promise<ChatCompletionResponse>;
  async chat(
    messages: ChatMessage[],
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      stream: true;
    },
  ): Promise<ReadableStream<VeniceStreamChunk>>;
  async chat(
    messages: ChatMessage[],
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
    } = {},
  ): Promise<ChatCompletionResponse | ReadableStream<VeniceStreamChunk>> {
    const body: Record<string, unknown> = {
      model: options.model ?? this.model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096,
      stream: options.stream ?? false,
    };

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Venice API error ${res.status}: ${errText}`);
    }

    if (options.stream) {
      return this.parseSSEStream(res);
    }

    return (await res.json()) as ChatCompletionResponse;
  }

  /**
   * Convenience: single prompt → string response
   */
  async prompt(
    userPrompt: string,
    systemPrompt?: string,
    options?: { model?: string; temperature?: number; maxTokens?: number },
  ): Promise<string> {
    const messages: ChatMessage[] = [];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: userPrompt });

    const response = await this.chat(messages, { ...options, stream: false });
    return response.choices[0]?.message?.content ?? "";
  }

  /**
   * Generate a PineScript strategy from a natural-language description
   */
  async generateStrategy(
    description: string,
    options?: { model?: string },
  ): Promise<string> {
    const systemPrompt = `You are an expert PineScript v5 developer. You write clean, well-commented TradingView PineScript code.
When asked to create a strategy, always:
1. Use //@version=5
2. Include strategy() declaration with appropriate settings
3. Define clear entry and exit conditions
4. Add input() parameters for tuneable values
5. Plot relevant indicators on the chart
6. Return ONLY the PineScript code, no explanations outside the code block.`;

    const response = await this.prompt(description, systemPrompt, options);

    // Extract code block if wrapped in markdown
    const codeBlockMatch = response.match(
      /```(?:pinescript|pine)?\n([\s\S]*?)```/,
    );
    return codeBlockMatch ? codeBlockMatch[1].trim() : response.trim();
  }

  /**
   * Analyse backtest results and suggest improvements
   */
  async analyseResults(
    strategyCode: string,
    metricsJson: string,
    options?: { model?: string },
  ): Promise<string> {
    const systemPrompt = `You are an expert quantitative analyst who reviews PineScript trading strategies.
Given a strategy's source code and its backtest metrics (JSON), provide:
1. A brief assessment of the strategy's performance
2. Specific, actionable suggestions to improve it
3. Potential risks or biases (look-ahead, survivorship, overfitting)
Be concise and technical.`;

    const userPrompt = `## Strategy Code\n\`\`\`pinescript\n${strategyCode}\n\`\`\`\n\n## Backtest Metrics\n\`\`\`json\n${metricsJson}\n\`\`\`\n\nPlease analyse and suggest improvements.`;

    return this.prompt(userPrompt, systemPrompt, options);
  }

  /**
   * Parse an SSE stream from the Venice API
   */
  private parseSSEStream(res: Response): ReadableStream<VeniceStreamChunk> {
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    return new ReadableStream<VeniceStreamChunk>({
      async pull(controller) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            controller.close();
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;
            const data = trimmed.slice(6);
            if (data === "[DONE]") {
              controller.close();
              return;
            }
            try {
              const chunk = JSON.parse(data) as VeniceStreamChunk;
              controller.enqueue(chunk);
            } catch {
              // skip malformed chunks
            }
          }
        }
      },
    });
  }
}

/**
 * Create a Venice client from an API key (or VENICE_API_KEY env var)
 */
export function createVeniceClient(
  apiKeyOrConfig?: string | VeniceConfig,
): VeniceClient {
  if (typeof apiKeyOrConfig === "string") {
    return new VeniceClient({ apiKey: apiKeyOrConfig });
  }
  if (apiKeyOrConfig) {
    return new VeniceClient(apiKeyOrConfig);
  }
  const envKey =
    typeof process !== "undefined" ? process.env?.VENICE_API_KEY : undefined;
  if (!envKey) {
    throw new Error(
      "No Venice API key provided. Pass one explicitly or set VENICE_API_KEY.",
    );
  }
  return new VeniceClient({ apiKey: envKey });
}
