import ReactMarkdown, { type UrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";

const safeUrl: UrlTransform = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : "";
  } catch {
    return "";
  }
};

const allowedElements = [
  "a",
  "blockquote",
  "br",
  "code",
  "del",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "li",
  "ol",
  "p",
  "pre",
  "strong",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "ul",
] as const;

/**
 * Renders untrusted Markdown without an HTML parser, remote images, or
 * non-HTTP(S) navigation. Keeping the policy here gives both Creator and
 * Client views one security seam.
 */
export const SafeMarkdown = ({ markdown }: { markdown: string }) => (
  <article className="prose prose-slate min-w-0 max-w-none overflow-x-auto rounded-xl border border-line bg-white p-5 [overflow-wrap:anywhere] prose-a:text-forest">
    <ReactMarkdown
      allowedElements={[...allowedElements]}
      components={{
        a: ({ href, children }) =>
          href ? (
            <a
              href={href}
              referrerPolicy="no-referrer"
              rel="noopener noreferrer"
              target="_blank"
            >
              {children}
            </a>
          ) : (
            <span>{children}</span>
          ),
        img: () => null,
      }}
      remarkPlugins={[remarkGfm]}
      skipHtml
      unwrapDisallowed
      urlTransform={safeUrl}
    >
      {markdown}
    </ReactMarkdown>
  </article>
);

