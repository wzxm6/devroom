import { useState, useEffect, useRef, useCallback } from 'react';
import { SearchResults, EMPTY_SEARCH_RESULTS, SEARCH_MIN_LENGTH, SEARCH_DEBOUNCE_MS } from '@/types/search';
import { searchService } from '@/services/searchService';

// Debounced workspace search with stale-response cancellation: only the
// latest issued query may update state, so fast typists never see results
// from an outdated keystroke.
export const useGlobalSearch = (workspaceId: string | undefined) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>(EMPTY_SEARCH_RESULTS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const requestIdRef = useRef(0);

  const active = query.trim().length >= SEARCH_MIN_LENGTH;

  useEffect(() => {
    const trimmed = query.trim();
    if (!workspaceId || trimmed.length < SEARCH_MIN_LENGTH) {
      setResults(EMPTY_SEARCH_RESULTS);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    const requestId = ++requestIdRef.current;
    const timer = setTimeout(async () => {
      try {
        const data = await searchService.searchWorkspace(workspaceId, trimmed);
        // Ignore stale responses from superseded keystrokes
        if (requestIdRef.current !== requestId) return;
        setResults(data);
      } catch (err) {
        if (requestIdRef.current !== requestId) return;
        const msg = err instanceof Error ? err.message : 'Search failed.';
        setError(msg);
        setResults(EMPTY_SEARCH_RESULTS);
      } finally {
        if (requestIdRef.current === requestId) setLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, workspaceId, attempt]);

  const clear = useCallback(() => {
    requestIdRef.current += 1;
    setQuery('');
    setResults(EMPTY_SEARCH_RESULTS);
    setError(null);
    setLoading(false);
  }, []);

  const totalCount =
    results.projects.length + results.posts.length + results.tasks.length + results.files.length;

  return {
    query,
    setQuery,
    results,
    totalCount,
    loading,
    error,
    active,
    clear,
    retry: () => setAttempt((a) => a + 1),
  };
};
