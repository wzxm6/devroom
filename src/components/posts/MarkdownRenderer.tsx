import React, { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { cn } from '@/lib/utils';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className }) => {
  const sanitizedHtml = useMemo(() => {
    if (!content) return '';

    // Configure marked options
    marked.setOptions({
      gfm: true,
      breaks: true,
    });

    // Parse markdown to raw HTML
    const rawHtml = marked.parse(content) as string;

    // Sanitize to prevent XSS / malicious scripts
    return DOMPurify.sanitize(rawHtml, {
      ALLOWED_TAGS: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'p', 'b', 'i', 'em', 'strong', 'strike', 'del',
        'a', 'ul', 'ol', 'li', 'blockquote',
        'code', 'pre', 'hr', 'br', 'span', 'table', 'thead', 'tbody', 'tr', 'th', 'td'
      ],
      ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'class'],
    });
  }, [content]);

  return (
    <div
      className={cn(
        'prose prose-invert max-w-none text-xs leading-relaxed space-y-3',
        '[&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-foreground [&_h1]:border-b [&_h1]:border-border/60 [&_h1]:pb-1.5 [&_h1]:mt-4 [&_h1]:mb-2',
        '[&_h2]:text-base [&_h2]:font-bold [&_h2]:text-foreground [&_h2]:mt-3 [&_h2]:mb-2',
        '[&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-2 [&_h3]:mb-1',
        '[&_p]:text-foreground/90 [&_p]:my-1.5',
        '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1.5 [&_li]:my-0.5',
        '[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1.5 [&_li]:my-0.5',
        '[&_blockquote]:border-l-2 [&_blockquote]:border-primary/50 [&_blockquote]:bg-muted/30 [&_blockquote]:pl-3 [&_blockquote]:py-1 [&_blockquote]:my-2 [&_blockquote]:italic [&_blockquote]:text-muted-foreground',
        '[&_pre]:bg-background/80 [&_pre]:border [&_pre]:border-border/80 [&_pre]:rounded-md [&_pre]:p-3 [&_pre]:overflow-x-auto [&_pre]:my-2.5 [&_pre]:font-mono [&_pre]:text-xs',
        '[&_code]:font-mono [&_code]:text-primary [&_code]:bg-muted/70 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[11px]',
        '[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-foreground [&_pre_code]:text-xs',
        '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-primary/80',
        '[&_hr]:border-border/60 [&_hr]:my-4',
        className
      )}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
};
