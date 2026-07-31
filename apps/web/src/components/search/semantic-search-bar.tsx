/**
 * Semantic search bar with debounced input and results dropdown.
 * Click a result to select the song (calls onSelectSong).
 * Clicking outside dismisses the dropdown.
 */

import { useRef, useEffect } from "react";
import { useSearch } from "@/hooks/use-search";
import SearchResultItem from "./search-result-item";

interface SemanticSearchBarProps {
  onSelectSong: (id: string) => void;
}

export default function SemanticSearchBar({ onSelectSong }: SemanticSearchBarProps) {
  const { query, setQuery, results, loading, error, clear } = useSearch();
  const containerRef = useRef<HTMLDivElement>(null);

  // Dismiss dropdown on outside click
  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        clear();
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [clear]);

  const showDropdown = query.trim().length > 0 && (loading || results.length > 0 || !!error);

  const handleSelect = (id: string) => {
    onSelectSong(id);
    clear();
  };

  return (
    <div ref={containerRef} style={{ position: "relative", width: 240 }}>
      {/* Search input */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          background: "var(--bg-primary)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: "0 8px",
          height: 30,
          gap: 6,
        }}
      >
        {/* Search icon */}
        <svg
          width={12}
          height={12}
          viewBox="0 0 16 16"
          fill="none"
          stroke="var(--text-muted)"
          strokeWidth={2}
          strokeLinecap="round"
        >
          <circle cx={6} cy={6} r={5} />
          <line x1={10} y1={10} x2={15} y2={15} />
        </svg>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search songs…"
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            fontSize: 12,
            color: "var(--text-primary)",
          }}
        />

        {query && (
          <button
            type="button"
            onClick={clear}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              fontSize: 14,
              lineHeight: 1,
              padding: 0,
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            zIndex: 100,
            maxHeight: 320,
            overflowY: "auto",
          }}
        >
          {loading && (
            <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-muted)" }}>
              Searching…
            </div>
          )}

          {!loading && error && (
            <div style={{ padding: "10px 12px", fontSize: 12, color: "#f87171" }}>
              {error}
            </div>
          )}

          {!loading && !error && results.length === 0 && (
            <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-muted)" }}>
              No songs found
            </div>
          )}

          {!loading &&
            results.map((r) => (
              <SearchResultItem key={r.id} result={r} onClick={handleSelect} />
            ))}
        </div>
      )}
    </div>
  );
}
