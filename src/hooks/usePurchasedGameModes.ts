import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { GameMode } from "@/lib/checkout";

interface UsePurchasedGameModesResult {
  owned: Set<GameMode>;
  loading: boolean;
  refetch: () => Promise<void>;
}

/**
 * Reads which game modes the given host has unlocked. Backed by the
 * get_unlocked_game_modes RPC, which returns purchased_game_modes rows
 * (populated only by the stripe-webhook edge function after a real payment)
 * for regular hosts, or every mode for hosts with the admin role.
 */
export function usePurchasedGameModes(hostId: string | null | undefined): UsePurchasedGameModesResult {
  const [owned, setOwned] = useState<Set<GameMode>>(new Set());
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!hostId) {
      setOwned(new Set());
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc("get_unlocked_game_modes", {
        p_host_id: hostId,
      });

      if (error) throw error;
      setOwned(new Set((data ?? []) as GameMode[]));
    } catch (err) {
      console.error("usePurchasedGameModes fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [hostId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { owned, loading, refetch };
}
