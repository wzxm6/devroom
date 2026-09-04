import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  FolderGit2,
  FileText,
  CheckSquare,
  File,
  AlertCircle,
  RefreshCw,
  Loader2,
  CornerDownLeft,
} from 'lucide-react';
import { SearchResultItem, SearchResultType, SEARCH_TYPE_LABELS } from '@/types/search';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface SearchPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string | undefined;
  workspaceName?: string | null;
}

const TYPE_ICONS: Record<SearchResultType, React.ElementType> = {
  project: FolderGit2,
  post: FileText,
  task: CheckSquare,
  file: File,
};

const GROUP_ORDER: SearchResultType[] = ['project', 'post', 'task', 'file'];

export const SearchPalette: React.FC<SearchPaletteProps> = ({
  isOpen,
  onClose,
  workspaceId,
  workspaceName,
}) => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { query, setQuery, results, totalCount, loading, error, active, clear, retry } =
    useGlobalSearch(workspaceId);

  const flatResults: SearchResultItem[] = useMemo(
    () => GROUP_ORDER.flatMap((type) => results[`${type}s` as keyof typeof results]),
    [results]
  );

  // Reset selection whenever the result set changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [flatResults.length, query]);

  // Autofocus + Escape handling + body scroll lock while open
  useEffect(() => {
    if (!isOpen) return;
    setSelectedIndex(0);
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Clear the query when the palette closes so each opening starts fresh
  useEffect(() => {
    if (!isOpen) clear();
  }, [isOpen, clear]);

  if (!isOpen) return null;

  const openResult = (item: SearchResultItem) => {
    onClose();
    navigate(item.target);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => (flatResults.length === 0 ? 0 : (i + 1) % flatResults.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) =>
        flatResults.length === 0 ? 0 : (i - 1 + flatResults.length) % flatResults.length
      );
    } else if (e.key === 'Enter') {
      const item = flatResults[selectedIndex];
      if (item) openResult(item);
    }
  };

  let runningIndex = -1;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[10vh]">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in"
        onClick={onClose}
      />

      {/* Palette */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Global search"
        className="relative w-full max-w-xl rounded-lg border border-border bg-card shadow-xl z-10 animate-in fade-in zoom-in-95 duration-150 overflow-hidden"
      >
        {/* Search input */}
        <div className="flex items-center gap-2.5 px-4 border-b border-border">
          {loading ? (
            <Loader2 className="h-4 w-4 text-muted-foreground animate-spin shrink-0" />
          ) : (
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={`Search ${workspaceName || 'workspace'} — projects, posts, tasks, files...`}
            aria-label="Search workspace"
            className="w-full bg-transparent py-3.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-[11px] text-muted-foreground hover:text-foreground shrink-0"
            >
              Clear
            </button>
          )}
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2">
          {!active ? (
            <div className="p-2">
              <EmptyState
                icon={Search}
                title="Search your workspace"
                description="Type at least 2 characters to search across projects, posts, tasks, and files."
              />
            </div>
          ) : error ? (
            <div className="p-6 text-center space-y-3">
              <AlertCircle className="h-6 w-6 text-destructive mx-auto" />
              <h4 className="text-xs font-semibold text-destructive">{error}</h4>
              <Button variant="outline" size="sm" onClick={retry} className="text-xs">
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry
              </Button>
            </div>
          ) : loading && totalCount === 0 ? (
            <div className="p-4 space-y-2.5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 px-2">
                  <div className="h-7 w-7 rounded-md bg-muted/70 animate-pulse shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 w-2/3 rounded bg-muted/70 animate-pulse" />
                    <div className="h-3 w-1/3 rounded bg-muted/70 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : totalCount === 0 ? (
            <div className="p-2">
              <EmptyState
                icon={Search}
                title={`No results for "${query.trim()}"`}
                description="Try different keywords, or check another project in this workspace."
              />
            </div>
          ) : (
            GROUP_ORDER.map((type) => {
              const items = results[`${type}s` as keyof typeof results];
              if (items.length === 0) return null;
              return (
                <div key={type} className="mb-1 last:mb-0">
                  <div className="px-2.5 pt-2 pb-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    {SEARCH_TYPE_LABELS[type]} ({items.length})
                  </div>
                  {items.map((item) => {
                    runningIndex += 1;
                    const index = runningIndex;
                    const isSelected = index === selectedIndex;
                    const ItemIcon = TYPE_ICONS[item.type];
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => openResult(item)}
                        onMouseEnter={() => setSelectedIndex(index)}
                        className={cn(
                          'w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-left transition-colors',
                          isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border',
                            isSelected
                              ? 'border-primary/30 bg-primary/10 text-primary'
                              : 'border-border bg-muted/40 text-muted-foreground'
                          )}
                        >
                          <ItemIcon className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-medium text-foreground truncate">
                            {item.title}
                          </span>
                          {item.subtitle && (
                            <span className="block text-[11px] text-muted-foreground truncate mt-0.5">
                              {item.subtitle}
                            </span>
                          )}
                        </span>
                        {isSelected && (
                          <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer hints */}
        <div className="hidden sm:flex items-center gap-4 px-4 py-2 border-t border-border/60 text-[10px] text-muted-foreground font-mono">
          <span className="flex items-center gap-1">
            <kbd className="px-1 rounded border border-border bg-muted">↑↓</kbd> navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 rounded border border-border bg-muted">↵</kbd> open
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 rounded border border-border bg-muted">esc</kbd> close
          </span>
          <span className="ml-auto flex items-center gap-1">
            <Search className="h-3 w-3" /> scoped to this workspace
          </span>
        </div>
      </div>
    </div>
  );
};
