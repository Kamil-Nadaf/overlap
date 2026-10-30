import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import type { EventBundle } from '../types';

/** Loads an event and refreshes it every 15s (pauses while the tab is hidden). */
export function useEvent(id: string | undefined) {
  const [bundle, setBundle] = useState<EventBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!id) return;
    try {
      const b = await api.getEvent(id);
      setBundle(b);
      setError(null);
    } catch {
      setError('network');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    void refresh();
    const t = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 15000);
    return () => clearInterval(t);
  }, [refresh]);

  return { bundle, loading, error, refresh };
}
