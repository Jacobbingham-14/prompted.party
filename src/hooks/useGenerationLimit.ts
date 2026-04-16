import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface GenerationLimit {
  allowed: boolean;
  currentCount: number;
  maxLimit: number;
  remaining: number;
}

interface UseGenerationLimitResult extends GenerationLimit {
  loading: boolean;
  refetch: () => Promise<void>;
  decrementLocally: () => void;
}

export function useGenerationLimit(hostId: string | null | undefined): UseGenerationLimitResult {
  const [state, setState] = useState<GenerationLimit>({
    allowed: true,
    currentCount: 0,
    maxLimit: 100,
    remaining: 100,
  });
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!hostId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('check_generation_limit', {
        p_user_id: hostId,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (row) {
        setState({
          allowed: row.allowed,
          currentCount: Number(row.current_count),
          maxLimit: Number(row.max_limit),
          remaining: Number(row.remaining),
        });
      }
    } catch (err) {
      console.error('useGenerationLimit fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [hostId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  // Optimistically decrement locally for instant UI feedback
  const decrementLocally = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentCount: prev.currentCount + 1,
      remaining: Math.max(0, prev.remaining - 1),
      allowed: prev.remaining - 1 > 0,
    }));
  }, []);

  return {
    ...state,
    loading,
    refetch: fetch,
    decrementLocally,
  };
}
