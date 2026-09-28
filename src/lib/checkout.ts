import { supabase } from "@/integrations/supabase/client";

export type GameMode = "judge" | "voting" | "forgery" | "duel";

export type CheckoutRequest =
  | { type: "full_access" }
  | { type: "credits"; creditPacks: number };

/**
 * Calls the create-checkout-session edge function and redirects the browser to
 * the returned Stripe Checkout URL. If the caller is signed in, the purchase
 * goes to their account; full access can also be bought signed out, in which
 * case the account is created from the email entered at checkout.
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

export type ClaimResult =
  | { status: "pending" }
  | { status: "unpaid" }
  | { status: "complete" }
  | { status: "sign_in"; email: string; tokenHash: string }
  | { status: "existing_account"; email: string };

/**
 * After Stripe redirects back, asks the claim-checkout edge function whether
 * the purchase is fulfilled and, for guest checkouts, gets a one-time token
 * that signs the buyer into the account created for them.
 */
export async function claimCheckout(sessionId: string): Promise<ClaimResult> {
  const { data, error } = await supabase.functions.invoke("claim-checkout", {
    body: { sessionId },
  });

  if (error) {
    throw new Error(error.message || "Failed to confirm purchase");
  }

  return data as ClaimResult;
}
