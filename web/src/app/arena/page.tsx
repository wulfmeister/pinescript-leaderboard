"use client";

import { useState } from "react";

const VENICE_MODELS = ["kimi-k2-thinking", "zai-org-glm-4.7", "grok-41-fast"];

interface TournamentStanding {
  model: string;
  elo: number;
  wins: number;
  losses: number;
  ties: number;
  totalMatches: number;
  avgReturn: number;
  avgSharpe: number;
  avgTrades: number;
}

interface MatchupCompetitor {
  model: string;
  score: number;
  error?: string;
  codeLength: number;
  generatedCode: string;
  metrics: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    totalTrades: number;
  } | null;
  finalCapital: number | null;
}

interface Matchup {
  prompt: string;
  winner: string | null;
  competitors: MatchupCompetitor[];
}

interface TournamentResult {
  standings: TournamentStanding[];
  matchups: Matchup[];
  elapsedMs: number;
}

type Tab = "generate" | "tournament";

export default function ArenaPage() {
  const [tab, setTab] = useState<Tab>("generate");

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">LLM Arena</h1>
      <p className="text-zinc-400">
        Generate strategies with AI, or run multi-model tournaments to find the
        best LLM for strategy generation.
      </p>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-zinc-900 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab("generate")}
          className={`px-4 py-2 rounded-md text-sm transition-colors ${
            tab === "generate"
              ? "bg-zinc-700 text-white"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          Generate & Chat
        </button>
        <button
          onClick={() => setTab("tournament")}
          className={`px-4 py-2 rounded-md text-sm transition-colors ${
            tab === "tournament"
              ? "bg-zinc-700 text-white"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          Tournament
        </button>
      </div>

      {tab === "generate" ? <GenerateTab /> : <TournamentTab />}
    </div>
  );
}

// ────────────────────────────────────────────────────
// Generate & Chat Tab (original functionality)
// ────────────────────────────────────────────────────

function GenerateTab() {
  const [description, setDescription] = useState(
    "Create a strategy that buys when RSI is below 30 and sells when RSI is above 70. Use a 14-period RSI.",
  );
  const [model, setModel] = useState(VENICE_MODELS[0]);
  const [generatedCode, setGeneratedCode] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Chat
  const [chatMessages, setChatMessages] = useState<
    { role: string; content: string }[]
  >([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const generateStrategy = async () => {
    setLoading(true);
    setError("");
    setGeneratedCode("");
    try {
      const res = await fetch("/api/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          description,
          model,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setGeneratedCode(data.code);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const analyseStrategy = async () => {
    if (!generatedCode) return;
    setLoading(true);
    setError("");
    setAnalysis("");
    try {
      // First backtest
      const btRes = await fetch("/api/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: generatedCode, mock: true }),
      });
      const btData = await btRes.json();

      // Then analyse
      const res = await fetch("/api/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "analyse",
          strategyCode: generatedCode,
          metricsJson: JSON.stringify(btData.metrics || {}, null, 2),
          model,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAnalysis(data.analysis);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const sendChat = async () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setChatLoading(true);
    try {
      const res = await fetch("/api/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "chat",
          prompt: userMsg,
          model,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.response },
      ]);
    } catch (e: any) {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${e.message}` },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <>
      {/* Model selector */}
      <div className="card">
        <label className="block text-sm text-zinc-400 mb-2">Venice Model</label>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="w-full md:w-auto"
        >
          {VENICE_MODELS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="card border-red-800 bg-red-950/50 text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Generator */}
        <div className="space-y-4">
          <div className="card space-y-4">
            <h2 className="font-semibold text-white">Generate Strategy</h2>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full"
              placeholder="Describe the strategy you want..."
            />
            <button
              onClick={generateStrategy}
              disabled={loading}
              className="btn btn-primary w-full"
            >
              {loading ? "Generating..." : "Generate with Venice AI"}
            </button>
          </div>

          {generatedCode && (
            <div className="card space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-white">Generated Code</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => navigator.clipboard.writeText(generatedCode)}
                    className="btn btn-ghost text-xs"
                  >
                    Copy
                  </button>
                  <button
                    onClick={analyseStrategy}
                    disabled={loading}
                    className="btn btn-ghost text-xs"
                  >
                    {loading ? "..." : "Analyse"}
                  </button>
                </div>
              </div>
              <pre className="bg-zinc-950 rounded-lg p-4 text-sm text-zinc-300 overflow-x-auto max-h-80 overflow-y-auto">
                {generatedCode}
              </pre>
            </div>
          )}

          {analysis && (
            <div className="card">
              <h2 className="font-semibold text-white mb-3">AI Analysis</h2>
              <div className="text-sm text-zinc-300 whitespace-pre-wrap">
                {analysis}
              </div>
            </div>
          )}
        </div>

        {/* Chat */}
        <div className="card flex flex-col h-[600px]">
          <h2 className="font-semibold text-white mb-4">Chat with Venice AI</h2>
          <div className="flex-1 overflow-y-auto space-y-3 mb-4">
            {chatMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <div className="text-3xl mb-3">&#x1F4AC;</div>
                <p className="text-zinc-400 text-sm font-medium mb-1">
                  Chat with Venice AI
                </p>
                <p className="text-zinc-600 text-xs max-w-xs">
                  Ask questions about PineScript, trading strategies, technical
                  analysis, or get help building your next strategy.
                </p>
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div
                key={i}
                className={`rounded-lg px-4 py-3 text-sm ${
                  msg.role === "user"
                    ? "bg-brand-600/20 text-brand-100 ml-8"
                    : "bg-zinc-800 text-zinc-300 mr-8"
                }`}
              >
                <div className="text-xs text-zinc-500 mb-1">
                  {msg.role === "user" ? "You" : "Venice AI"}
                </div>
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
            ))}
            {chatLoading && (
              <div className="bg-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-500 mr-8">
                Thinking...
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendChat()}
              placeholder="Ask about PineScript..."
              className="flex-1"
            />
            <button
              onClick={sendChat}
              disabled={chatLoading}
              className="btn btn-primary"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ────────────────────────────────────────────────────
// Tournament Tab
// ────────────────────────────────────────────────────

function TournamentTab() {
  const [selectedModels, setSelectedModels] = useState<string[]>([
    VENICE_MODELS[0],
    VENICE_MODELS[2],
  ]);
  const [rounds, setRounds] = useState("1");
  const [useMock, setUseMock] = useState(true);
  const [capital, setCapital] = useState("10000");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TournamentResult | null>(null);
  const [error, setError] = useState("");
  const [expandedMatchup, setExpandedMatchup] = useState<number | null>(null);

  const toggleModel = (model: string) => {
    setSelectedModels((prev) =>
      prev.includes(model) ? prev.filter((m) => m !== model) : [...prev, model],
    );
  };

  const runTournament = async () => {
    if (selectedModels.length < 2) {
      setError("Select at least 2 models");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/arena", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          models: selectedModels,
          rounds: parseInt(rounds),
          mock: useMock,
          capital: parseFloat(capital),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const pct = (v: number) => `${(v * 100).toFixed(2)}%`;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-white">Tournament Settings</h2>

          <div className="bg-green-950/30 border border-green-900 rounded-lg p-3 text-xs text-green-200">
            <p className="font-medium mb-1">How LLM vs LLM works:</p>
            <ol className="list-decimal list-inside space-y-1 text-green-300/80">
              <li>
                Each round, all selected models receive the same strategy prompt
              </li>
              <li>Each LLM generates a PineScript trading strategy</li>
              <li>Strategies are backtested against historical market data</li>
              <li>
                Winner is determined by composite score (Sharpe, Return, Win
                Rate, Drawdown)
              </li>
              <li>
                Elo ratings are updated like chess — beating a strong model
                gains more points
              </li>
            </ol>
            <p className="mt-2 text-green-400/60 italic">
              The model with the highest Elo after all rounds wins the
              tournament.
            </p>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">
              Select Models (min 2)
            </label>
            <div className="space-y-2">
              {VENICE_MODELS.map((m) => (
                <label
                  key={m}
                  className="flex items-center gap-2 text-sm text-zinc-300"
                >
                  <input
                    type="checkbox"
                    checked={selectedModels.includes(m)}
                    onChange={() => toggleModel(m)}
                    className="rounded"
                  />
                  <span className="font-mono text-xs">{m}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Rounds</label>
            <input
              value={rounds}
              onChange={(e) => setRounds(e.target.value)}
              className="w-full"
              type="number"
              min="1"
              max="5"
            />
            <p className="text-xs text-zinc-600 mt-1">
              Each round uses a different strategy prompt
            </p>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Capital</label>
            <input
              value={capital}
              onChange={(e) => setCapital(e.target.value)}
              className="w-full"
              type="number"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-zinc-400">
            <input
              type="checkbox"
              checked={useMock}
              onChange={(e) => setUseMock(e.target.checked)}
              className="rounded"
            />
            Use mock data for backtesting
          </label>

          <button
            onClick={runTournament}
            disabled={loading || selectedModels.length < 2}
            className="btn btn-primary w-full"
          >
            {loading ? "Running Tournament..." : "Start Tournament"}
          </button>

          {loading && (
            <p className="text-xs text-zinc-500 text-center">
              This may take a while — each model generates and backtests a
              strategy per round.
            </p>
          )}
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-4">
          {error && (
            <div className="card border-red-800 bg-red-950/50 text-red-300">
              {error}
            </div>
          )}

          {!result && !loading && !error && (
            <div className="card text-center py-12">
              <p className="text-zinc-500 text-sm">
                Select models and click &ldquo;Start Tournament&rdquo; to begin.
                Each model will generate PineScript strategies from prompts,
                which are then backtested and compared.
              </p>
            </div>
          )}

          {result && (
            <>
              {/* Standings */}
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-white">Standings</h2>
                  <span className="text-xs text-zinc-500">
                    {(result.elapsedMs / 1000).toFixed(1)}s elapsed
                  </span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-zinc-500 text-left">
                      <th className="pb-2">#</th>
                      <th className="pb-2">Model</th>
                      <th className="pb-2 text-right">Elo</th>
                      <th className="pb-2 text-right">W/L/T</th>
                      <th className="pb-2 text-right">Avg Return</th>
                      <th className="pb-2 text-right">Avg Sharpe</th>
                    </tr>
                  </thead>
                  <tbody className="text-zinc-300">
                    {result.standings.map((s, i) => (
                      <tr
                        key={s.model}
                        className={`border-t border-zinc-800 ${i === 0 ? "bg-green-950/20" : ""}`}
                      >
                        <td className="py-2 text-zinc-500">{i + 1}</td>
                        <td className="py-2 font-mono text-xs">{s.model}</td>
                        <td className="py-2 text-right font-bold text-white">
                          {s.elo}
                        </td>
                        <td className="py-2 text-right">
                          <span className="text-green-400">{s.wins}</span>/
                          <span className="text-red-400">{s.losses}</span>/
                          <span className="text-zinc-400">{s.ties}</span>
                        </td>
                        <td
                          className={`py-2 text-right ${
                            s.avgReturn >= 0 ? "text-green-400" : "text-red-400"
                          }`}
                        >
                          {pct(s.avgReturn)}
                        </td>
                        <td className="py-2 text-right">
                          {s.avgSharpe.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Matchups */}
              <div className="card">
                <h2 className="font-semibold text-white mb-4">Round Details</h2>
                <div className="space-y-3">
                  {result.matchups.map((matchup, i) => (
                    <div
                      key={i}
                      className="bg-zinc-800/50 rounded-lg border border-zinc-700/50"
                    >
                      <button
                        onClick={() =>
                          setExpandedMatchup(expandedMatchup === i ? null : i)
                        }
                        className="w-full px-4 py-3 flex items-center justify-between text-left"
                      >
                        <div>
                          <span className="text-xs text-zinc-500">
                            Round {i + 1}
                          </span>
                          <p className="text-sm text-zinc-300 line-clamp-1">
                            {matchup.prompt}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          {matchup.winner && (
                            <span className="text-xs text-green-400 font-mono">
                              Winner: {matchup.winner}
                            </span>
                          )}
                          <span className="text-zinc-500">
                            {expandedMatchup === i ? "-" : "+"}
                          </span>
                        </div>
                      </button>

                      {expandedMatchup === i && (
                        <div className="px-4 pb-4 space-y-3">
                          <p className="text-xs text-zinc-400">
                            {matchup.prompt}
                          </p>
                          {matchup.competitors.map((c) => (
                            <div
                              key={c.model}
                              className={`bg-zinc-900/50 rounded-lg p-3 border ${
                                c.model === matchup.winner
                                  ? "border-green-800/50"
                                  : "border-zinc-700/30"
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-mono text-xs text-zinc-300">
                                  {c.model}
                                  {c.model === matchup.winner && (
                                    <span className="ml-2 text-green-400">
                                      Winner
                                    </span>
                                  )}
                                </span>
                                <span className="text-xs text-zinc-500">
                                  Score:{" "}
                                  {c.score === -Infinity
                                    ? "N/A"
                                    : c.score.toFixed(3)}
                                </span>
                              </div>
                              {c.error ? (
                                <p className="text-xs text-red-400">
                                  Error: {c.error}
                                </p>
                              ) : c.metrics ? (
                                <div className="grid grid-cols-3 gap-2 text-xs">
                                  <div>
                                    <span className="text-zinc-500">
                                      Return:{" "}
                                    </span>
                                    <span
                                      className={
                                        c.metrics.totalReturn >= 0
                                          ? "text-green-400"
                                          : "text-red-400"
                                      }
                                    >
                                      {pct(c.metrics.totalReturn)}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-zinc-500">
                                      Sharpe:{" "}
                                    </span>
                                    <span className="text-zinc-300">
                                      {c.metrics.sharpeRatio.toFixed(2)}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-zinc-500">
                                      Trades:{" "}
                                    </span>
                                    <span className="text-zinc-300">
                                      {c.metrics.totalTrades}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-zinc-500">
                                      Win Rate:{" "}
                                    </span>
                                    <span className="text-zinc-300">
                                      {pct(c.metrics.winRate)}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-zinc-500">
                                      Max DD:{" "}
                                    </span>
                                    <span className="text-zinc-300">
                                      {pct(c.metrics.maxDrawdown)}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-zinc-500">
                                      Code:{" "}
                                    </span>
                                    <span className="text-zinc-300">
                                      {c.codeLength} chars
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-xs text-zinc-500">
                                  No results
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
