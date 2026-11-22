import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";

const skip = () => null;
const inline = ({ children }: { children?: React.ReactNode }) => <span>{children} </span>;

export default function MarkdownPreview({
  children,
  className = "",
}: {
  children: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          // Dropped: headings usually repeat the product name, and these don't fit a preview
          h1: skip, h2: skip, h3: skip, h4: skip, h5: skip, h6: skip,
          hr: skip, table: skip, img: skip,

          // Block elements become inline text so line-clamp works across them
          p: inline,
          blockquote: inline,
          pre: inline,
          ul: ({ children }) => <span>{children}</span>,
          ol: ({ children }) => <span>{children}</span>,
          li: ({ children }) => <span>• {children} </span>,
          br: () => <span> </span>,

          // Keep light emphasis; avoid links inside a clickable card
          strong: ({ children }) => (
            <strong className="font-medium text-stone-800">{children}</strong>
          ),
          a: ({ children }) => <span>{children}</span>,
          code: ({ children }) => <span>{children}</span>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}