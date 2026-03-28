import { Children, Fragment } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  content: string;
}

export function MarkdownRenderer({ content }: Props) {
  if (!content) {
    return <p className="text-default-400 italic">Noch keine Informationen vorhanden.</p>;
  }

  const withLinkBreaks = (text: string) => {
    const parts = text.split(/([/-])/g);
    return parts.map((part, index) => (
      (part === '/' || part === '-')
        ? <Fragment key={`delimiter-${index}`}>{part}<wbr /></Fragment>
        : <Fragment key={`text-${index}`}>{part}</Fragment>
    ));
  };

  return (
    <div className="prose max-w-none break-words [&_a]:whitespace-normal [&_li]:break-words [&_p]:break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children, ...props }) => (
            <a {...props}>
              {Children.toArray(children).map((child, index) => (
                typeof child === 'string'
                  ? <Fragment key={index}>{withLinkBreaks(child)}</Fragment>
                  : child
              ))}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
