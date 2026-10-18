"use client";

import { useState } from "react";
import { LiquidCard, CardContent } from "@/components/ui/liquid-glass-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/liquid-glass-button";
import {
  LuxuryMembershipCard,
  type LuxuryCardModel,
} from "@/components/regalia/luxury-membership-card";

export function CreditCardForm({
  membership,
  amountLabel = "Complete purchase",
  busy = false,
  onPay,
}: {
  membership: LuxuryCardModel;
  amountLabel?: string;
  busy?: boolean;
  onPay?: () => void | Promise<void>;
}) {
  const [holder, setHolder] = useState(membership.holderName || "");

  return (
    <div className="mx-auto max-w-md space-y-6 p-6">
      <div>
        <p className="text-center text-[10px] uppercase tracking-[0.32em] text-champagne/70">
          You are buying
        </p>
        <h2 className="mt-2 text-center font-display text-3xl text-warm-white">
          {membership.tierName}
        </h2>
        <p className="mt-1 text-center text-sm text-warm-white/55">
          {membership.tierSubtitle}
        </p>
      </div>

      <LuxuryMembershipCard
        card={{
          ...membership,
          holderName: holder || membership.holderName,
          specimen: true,
          purchased: false,
        }}
      />

      <LiquidCard className="border-champagne/20 bg-ink/70">
        <CardContent className="space-y-4 p-6">
          <h3 className="text-center text-lg font-semibold text-warm-white">
            Confirm this membership card
          </h3>
          <div className="space-y-2">
            <Label htmlFor="cardName" className="text-warm-white/70">
              Name on membership card
            </Label>
            <Input
              id="cardName"
              placeholder="Cardholder name"
              value={holder}
              onChange={(e) => setHolder(e.target.value.toUpperCase())}
              className="uppercase border-champagne/25 bg-ink text-warm-white"
            />
          </div>
          <p className="text-center text-xs text-warm-white/45">
            This is the Regalia card you are purchasing. Payment IDs are issued
            after approval.
          </p>
          <Button
            className="mt-2 w-full bg-champagne text-ink hover:bg-champagne-bright"
            size="lg"
            disabled={busy}
            onClick={() => void onPay?.()}
          >
            {busy ? "Processing…" : amountLabel}
          </Button>
        </CardContent>
      </LiquidCard>
    </div>
  );
}
