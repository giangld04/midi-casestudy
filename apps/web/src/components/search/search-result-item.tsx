/**
 * Single search result row in the dropdown.
 * Shows song title, description preview, and similarity badge.
 */

import type { SearchResult } from "@/hooks/use-search";

interface SearchResultItemProps {
  result: SearchResult;
  onClick: (id: string) => void;
}

export default function SearchResultItem({ result, onClick }: SearchResultItemProps) {
  const pct = result.similarity !== null ? Math.round(result.similarity * 100) : null;

  return (
    <button
      type="button"
      onClick={() => onClick(result.id)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "8px 12px",
        background: "transparent",
        border: "none",
        borderBottom: "1px solid var(--border)",
        cursor: "pointer",
        textAlign: "left",
        color: "var(--text-primary)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-primary)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "transparent";
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {result.title}
        </div>
        {result.description && (
          <div
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              marginTop: 2,
            }}
          >
            {result.description}
          </div>
        )}
      </div>

      {pct !== null && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: "var(--accent)",
            background: "var(--bg-primary)",
            border: "1px solid var(--accent)",
            borderRadius: 4,
            padding: "1px 5px",
            flexShrink: 0,
          }}
        >
          {pct}%
        </span>
      )}
    </button>
  );
}
