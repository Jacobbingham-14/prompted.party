import { supabase } from "@/integrations/supabase/client";

export type GameMode = "judge" | "voting" | "forgery" | "duel";

export type CheckoutRequest =
  | { type: "single_mode"; modes: [GameMode] }
  | { type: "bundle_2"; modes: [GameMode, GameMode] }
  | { type: "bundle_4" }
  | { type: "credits"; creditPacks: number };

/**
 * Calls the create-checkout-session edge function (which reads the caller's
 * Supabase auth session to know which host is buying) and redirects the
 * browser to the returned Stripe Checkout URL.
 */
export async function startCheckout(payload: CheckoutRequest): Promise<void> {
  const { data, error } = await supabase.functions.invoke("create-checkout-session", {
    body: payload,
  });

  if (error) {
    throw new Error(error.message || "Failed to start checkout");
  }

  const url = (data as { url?: string } | null)?.url;
  if (!url) {
    throw new Error("Checkout session did not return a URL");
  }

  window.location.href = url;
}
