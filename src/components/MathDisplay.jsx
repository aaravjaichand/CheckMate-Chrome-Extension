/**
 * Shared Math wrapper component to prevent layout shift during KaTeX rendering
 * Used by both LatexRenderer and MessageRenderer
 */
export default function MathDisplay({ children }) {
  return (
    <div 
      className="my-2 min-h-[1.5em] flex items-center" 
      style={{ contain: 'layout style paint' }}
    >
      {children}
    </div>
  );
}

