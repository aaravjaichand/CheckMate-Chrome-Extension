import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

/**
 * Math wrapper component to prevent layout shift during KaTeX rendering
 * Wraps KaTeX content with stable sizing containers
 */
const MathDisplay = ({ children }) => (
  <div className="my-2 min-h-[1.5em] flex items-center" style={{ contain: 'layout style paint' }}>
    {children}
  </div>
);

/**
 * Optimized message renderer with markdown and LaTeX support
 * Uses React.memo to prevent unnecessary re-renders during streaming
 * Supports:
 * - Inline LaTeX: $E=mc^2$
 * - Block LaTeX: $$\frac{a}{b}$$
 * - Markdown: headers, bold, code blocks, lists, links
 */
const MessageRenderer = React.memo(({ content }) => {
  // Memoize the markdown rendering to prevent re-parsing on every render
  const renderedContent = useMemo(() => {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // Custom component styling for code blocks
          code: ({ inline, className, children, ...props }) => (
            <code
              className={`${
                inline
                  ? 'bg-gray-200 text-red-600 rounded px-1.5 py-0.5 font-mono text-xs'
                  : 'block bg-gray-900 text-gray-100 rounded-lg p-3 overflow-x-auto font-mono text-sm max-w-full'
              }`}
              style={inline ? {} : { width: 'fit-content', maxWidth: '100%' }}
              {...props}
            >
              {children}
            </code>
          ),
          // Custom styling for pre elements (wraps code blocks)
          pre: ({ children }) => (
            <div className="overflow-x-auto my-2 max-w-full">
              <pre className="!m-0 !p-0 !bg-transparent">
                {children}
              </pre>
            </div>
          ),
          // Custom component styling for inline code
          inlineCode: ({ children }) => (
            <code className="bg-gray-200 text-red-600 rounded px-1.5 py-0.5 font-mono text-xs">
              {children}
            </code>
          ),
          // Custom styling for links
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline hover:text-blue-700"
            >
              {children}
            </a>
          ),
          // Custom styling for lists
          ul: ({ children }) => (
            <ul className="list-disc list-inside space-y-1 ml-2">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-1 ml-2">
              {children}
            </ol>
          ),
          // Custom styling for headings
          h1: ({ children }) => (
            <h1 className="text-lg font-bold mt-4 mb-2">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-bold mt-3 mb-1.5">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-bold mt-2 mb-1">{children}</h3>
          ),
          // Custom styling for paragraphs
          p: ({ children }) => (
            <p className="leading-relaxed my-1">{children}</p>
          ),
          // Custom styling for blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-gray-300 pl-3 italic text-gray-700 my-2">
              {children}
            </blockquote>
          ),
          // Custom styling for tables - wrap in scrollable container
          table: ({ children }) => (
            <div className="overflow-x-auto my-2 max-w-full">
              <table className="border-collapse border border-gray-300 text-sm">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-gray-300 px-2 py-1 bg-gray-200">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-gray-300 px-2 py-1">
              {children}
            </td>
          ),
          // Wrap display math (block-level KaTeX) to prevent layout shift
          div: ({ children, className, ...props }) => {
            // Check if this is a KaTeX display math div
            if (className && className.includes('math math-display')) {
              return (
                <MathDisplay>
                  <div className={className} {...props}>
                    {children}
                  </div>
                </MathDisplay>
              );
            }
            return (
              <div className={className} {...props}>
                {children}
              </div>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    );
  }, [content]);

  return (
    <div className="text-sm leading-relaxed break-words markdown-content min-w-0" style={{ contain: 'layout style paint' }}>
      {renderedContent}
    </div>
  );
});

MessageRenderer.displayName = 'MessageRenderer';

export default MessageRenderer;
