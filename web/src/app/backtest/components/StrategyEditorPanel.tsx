"use client";

import { type SavedStrategy } from "../types";

interface Props {
  script: string;
  onScriptChange: (s: string) => void;
  savedStrategies: SavedStrategy[];
  showSaveDialog: boolean;
  showLoadDialog: boolean;
  saveName: string;
  saveMessage: string;
  onToggleSave: () => void;
  onToggleLoad: () => void;
  onSaveNameChange: (name: string) => void;
  onSave: () => void;
  onLoad: (s: SavedStrategy) => void;
  onDelete: (id: string) => void;
  onCancelSave: () => void;
}

export function StrategyEditorPanel({
  script,
  onScriptChange,
  savedStrategies,
  showSaveDialog,
  showLoadDialog,
  saveName,
  saveMessage,
  onToggleSave,
  onToggleLoad,
  onSaveNameChange,
  onSave,
  onLoad,
  onDelete,
  onCancelSave,
}: Props) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm text-zinc-400">
          PineScript Strategy
        </label>
        <div className="flex gap-2 items-center">
          {saveMessage && (
            <span className="text-xs text-green-400">{saveMessage}</span>
          )}
          <button onClick={onToggleLoad} className="btn btn-ghost text-xs">
            Load
          </button>
          <button onClick={onToggleSave} className="btn btn-ghost text-xs">
            Save
          </button>
        </div>
      </div>

      {showSaveDialog && (
        <div className="flex gap-2 mb-3">
          <input
            value={saveName}
            onChange={(e) => onSaveNameChange(e.target.value)}
            placeholder="Strategy name..."
            className="flex-1 text-sm"
            onKeyDown={(e) => e.key === "Enter" && onSave()}
          />
          <button onClick={onSave} className="btn btn-primary text-xs">
            Save
          </button>
          <button onClick={onCancelSave} className="btn btn-ghost text-xs">
            Cancel
          </button>
        </div>
      )}

      {showLoadDialog && (
        <div className="mb-3 max-h-48 overflow-y-auto space-y-1">
          {savedStrategies.length === 0 ? (
            <p className="text-xs text-zinc-500 py-2">
              No saved strategies yet.
            </p>
          ) : (
            savedStrategies.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between bg-zinc-800/50 rounded px-3 py-2 group"
              >
                <button
                  onClick={() => onLoad(s)}
                  className="text-sm text-zinc-300 hover:text-white text-left flex-1"
                >
                  <span className="font-medium">{s.name}</span>
                  <span className="text-xs text-zinc-500 ml-2">
                    {new Date(s.updatedAt).toLocaleDateString()}
                  </span>
                </button>
                <button
                  onClick={() => onDelete(s.id)}
                  className="text-xs text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity ml-2"
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>
      )}

      <textarea
        value={script}
        onChange={(e) => onScriptChange(e.target.value)}
        rows={14}
        className="w-full font-mono text-sm"
        spellCheck={false}
      />
    </div>
  );
}
