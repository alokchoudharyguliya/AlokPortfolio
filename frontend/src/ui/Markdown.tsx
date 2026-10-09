/**
 * Markdown renderer for owner-authored content (about, case studies, posts).
 * GitHub-flavoured markdown; raw HTML is NOT rendered (react-markdown default),
 * so content can never inject scripts. External links open in a new tab.
 */
import clsx from "clsx";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import styles from "./Markdown.module.css";

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={clsx(styles.prose, className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children: label, ...props }) => {
            const external = href?.startsWith("http");
            return (
              <a
                href={href}
                {...props}
                {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
              >
                {label}
              </a>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
