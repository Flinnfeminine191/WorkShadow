import type { SearchHit, SearchSnippetPart } from "../types";

export function SearchSnippetParts({
  parts,
  hit
}: {
  parts: SearchSnippetPart[];
  hit: SearchHit;
}) {
  return (
    <>
      {parts.map((part, index) => (
        <SearchSnippetPartView key={`${hit.chunk.id}-${index}`} part={part} hit={hit} />
      ))}
    </>
  );
}

function SearchSnippetPartView({ part, hit }: { part: SearchSnippetPart; hit: SearchHit }) {
  if (part.emphasis === "semantic-region") {
    return <span className="search-result__semantic-region">{part.text}</span>;
  }
  if (part.emphasis === "semantic-term" || (hit.matchKind === "semantic" && part.highlight)) {
    return <span className="search-result__semantic-term">{part.text}</span>;
  }
  if (part.emphasis === "keyword" || part.highlight) {
    return <mark className="search-result__mark--keyword">{part.text}</mark>;
  }
  return <span>{part.text}</span>;
}
