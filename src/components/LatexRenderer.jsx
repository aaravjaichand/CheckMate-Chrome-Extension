import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

/**
 * Math wrapper component to prevent layout shift during KaTeX rendering
 */
const MathDisplay = ({ children }) => (
  <div className="my-2 min-h-[1.5em] flex items-center" style={{ contain: 'layout style paint' }}>
    {children}
  </div>
);

/**
 * Component to render text with LaTeX math support
 * @param {Object} props
 * @param {string} props.children - The content to render
 * @param {string} props.className - Optional class name
 */
export default function LatexRenderer({ children, className = '' }) {
  if (!children) return null;

  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({ node, ...props }) => <p className="mb-1 last:mb-0" {...props} />,
          // Wrap display math (block-level KaTeX) to prevent layout shift
          div: ({ children, className, ...props }) => {
            if (className && className.includes('math math-display')) {
              return (
                <MathDisplay>
                  <div className={className} {...props}>
                    {children}
                  </div>
                </MathDisplay>
              );
            }
            return <div className={className} {...props}>{children}</div>;
          },
          // Ensure inline code doesn't break layout
          code: ({ inline, className, children, ...props }) => (
            <code
              className={`${inline
                  ? 'bg-gray-100 text-red-600 rounded px-1 py-0.5 font-mono text-xs'
                  : 'block bg-gray-900 text-gray-100 rounded-lg p-3 overflow-x-auto font-mono text-sm'
                }`}
              {...props}
            >
              {children}
            </code>
          )
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
