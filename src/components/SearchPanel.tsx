import { useTranslation } from "react-i18next";
import { SearchSnippetParts } from "./SearchSnippetParts";
import type { SearchResult } from "../types";

interface Props {
  results: SearchResult[];
  onSelect: (id: string) => void;
}

export function SearchPanel({ results, onSelect }: Props) {
  const { t } = useTranslation();
  return (
    <section className="search-results" aria-label={t("searchPlaceholder")}>
      {results.length > 0 ? <p className="search-results__hint muted">{t("searchResultLogHint")}</p> : null}
      {results.length === 0 ? (
        <p className="muted">{t("noResults")}</p>
      ) : (
        results.map((result) => {
          const title = result.node?.title ?? result.parentPath;
          const showPath = result.parentPath && result.node?.title !== result.parentPath;
          return (
            <button
              key={result.logId}
              type="button"
              className="search-result"
              onClick={() => onSelect(result.logId)}
            >
              <div className="search-result__head">
                <strong className="search-result__title">{title}</strong>
                {result.matchCount > 1 ? (
                  <span className="search-result__badge">{t("searchResultMatchCount", { count: result.matchCount })}</span>
                ) : null}
              </div>
              {showPath ? <span className="search-result__path">{result.parentPath}</span> : null}
              <div className="search-result__snippets">
                {result.hits.map((hit) => (
                  <span
                    key={hit.chunk.id}
                    className={`search-result__snippet${hit.matchKind === "semantic" ? " search-result__snippet--semantic" : ""}`}
                  >
                    {hit.matchKind === "semantic" ? (
                      <span className="search-result__snippet-tag">{t("searchHitSemantic")}</span>
                    ) : null}
                    <SearchSnippetParts parts={hit.summaryParts} hit={hit} />
                  </span>
                ))}
              </div>
              {result.matchCount > result.hits.length ? (
                <span className="search-result__more muted">
                  {t("searchResultMoreSnippets", { count: result.matchCount - result.hits.length })}
                </span>
              ) : null}
            </button>
          );
        })
      )}
    </section>
  );
}
