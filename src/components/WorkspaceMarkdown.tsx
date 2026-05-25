import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const markdownLink: Components["a"] = ({ href, children, ...props }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
    {children}
  </a>
);

interface Props {
  source: string;
  className?: string;
}

/** 工作台 LLM 输出：GFM Markdown 渲染 */
export function WorkspaceMarkdown({ source, className }: Props) {
  const remarkPlugins = useMemo(() => [remarkGfm], []);
  const components = useMemo<Components>(() => ({ a: markdownLink }), []);

  return (
    <div className={className ? `workspace-markdown ${className}` : "workspace-markdown"}>
      <ReactMarkdown remarkPlugins={remarkPlugins} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
