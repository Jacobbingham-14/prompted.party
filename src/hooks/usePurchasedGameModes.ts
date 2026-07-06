import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { GameMode } from "@/lib/checkout";

interface UsePurchasedGameModesResult {
  owned: Set<GameMode>;
  loading: boolean;
  refetch: () => Promise<void>;
}

/**
 * Reads which game modes the given host has unlocked (purchased_game_modes
 * table, populated only by the stripe-webhook edge function after a real
 * payment). Table isn't in the generated Supabase types yet, hence the `any`
 * cast on the query builder.
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
      const { data, error } = await (supabase as any)
        .from("purchased_game_modes")
        .select("game_mode")
        .eq("host_id", hostId);

      if (error) throw error;
      setOwned(new Set((data ?? []).map((row: { game_mode: GameMode }) => row.game_mode)));
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
