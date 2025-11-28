import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import MathDisplay from './MathDisplay';
import 'katex/dist/katex.min.css';

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
          p: ({ ...props }) => <p className="mb-1 last:mb-0" {...props} />,
          div: ({ children: divChildren, className: divClassName, ...props }) => {
            if (divClassName?.includes('math math-display')) {
              return (
                <MathDisplay>
                  <div className={divClassName} {...props}>{divChildren}</div>
                </MathDisplay>
              );
            }
            return <div className={divClassName} {...props}>{divChildren}</div>;
          },
          code: ({ inline, children: codeChildren, ...props }) => (
            <code
              className={inline
                ? 'bg-gray-100 text-red-600 rounded px-1 py-0.5 font-mono text-xs'
                : 'block bg-gray-900 text-gray-100 rounded-lg p-3 overflow-x-auto font-mono text-sm'
              }
              {...props}
            >
              {codeChildren}
            </code>
          )
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
