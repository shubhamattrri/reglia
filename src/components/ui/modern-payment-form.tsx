"use client";

import { useState, type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/money";

export type PaymentFormValues = {
  cardholderName: string;
  cardNumber: string;
  expiryDate: string;
  cvv: string;
  method: "card" | "paypal" | "apple" | "google";
};

export default function RuixenPaymentCard({
  amount = 0,
  currency = "GBP",
  tierName,
  defaultCardholderName = "",
  busy = false,
  walletMethods = true,
  note,
  onPay,
}: {
  amount?: number;
  currency?: string;
  tierName?: string;
  defaultCardholderName?: string;
  busy?: boolean;
  /** Hide PayPal / Apple Pay / Google Pay when the card must be saved for renewals. */
  walletMethods?: boolean;
  note?: ReactNode;
  onPay?: (values: PaymentFormValues) => void | Promise<void>;
}) {
  const [method, setMethod] = useState<PaymentFormValues["method"]>("card");
  const [cardholderName, setCardholderName] = useState(defaultCardholderName);
  const [cardNumber, setCardNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [cvv, setCvv] = useState("");

  function submit() {
    void onPay?.({
      cardholderName,
      cardNumber,
      expiryDate,
      cvv,
      method: walletMethods ? method : "card",
    });
  }

  return (
    <div className="flex items-center justify-center p-1">
      <Card className="w-full max-w-md rounded-2xl border-champagne/25 bg-ink-deep text-warm-white shadow-[0_24px_70px_-20px_rgba(59,40,25,0.35)]">
        <CardContent className="space-y-6 p-6">
          {tierName ? (
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-[0.28em] text-champagne/70">
                Membership amount
              </p>
              <p className="mt-1 font-display text-3xl text-warm-white">
                {formatMoney(amount, currency)}
              </p>
              <p className="mt-1 text-sm text-warm-white/50">{tierName}</p>
            </div>
          ) : null}

          {walletMethods ? (
          <>
          <div className="grid grid-cols-3 gap-3">
            <PayMethod
              active={method === "paypal"}
              onClick={() => setMethod("paypal")}
              label="PayPal"
              icon={<PayPalMark />}
            />
            <PayMethod
              active={method === "apple"}
              onClick={() => setMethod("apple")}
              label="Pay"
              icon={<AppleMark />}
            />
            <PayMethod
              active={method === "google"}
              onClick={() => setMethod("google")}
              label="Pay"
              icon={<GoogleMark />}
            />
          </div>

          <div className="flex items-center text-warm-white/45">
            <hr className="flex-grow border-t border-white/10" />
            <span className="mx-2 text-[10px] font-medium uppercase tracking-[0.16em]">
              or pay using credit card
            </span>
            <hr className="flex-grow border-t border-white/10" />
          </div>
          </>
          ) : null}

          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="cardholder-name" className="text-warm-white/70">
                Card holder full name
              </Label>
              <Input
                id="cardholder-name"
                name="cardholderName"
                placeholder="Enter your full name"
                value={cardholderName}
                onChange={(e) => setCardholderName(e.target.value)}
                className="border-white/10 bg-[#2a2622] text-warm-white"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="card-number" className="text-warm-white/70">
                Card Number
              </Label>
              <Input
                id="card-number"
                name="cardNumber"
                placeholder="0000 0000 0000 0000"
                inputMode="numeric"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                className="border-white/10 bg-[#2a2622] text-warm-white"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="expiry" className="text-warm-white/70">
                Expiry Date / CVV
              </Label>
              <div className="flex gap-4">
                <Input
                  id="expiry"
                  name="expiryDate"
                  placeholder="01/23"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="border-white/10 bg-[#2a2622] text-warm-white"
                />
                <Input
                  id="cvv"
                  name="cvv"
                  placeholder="CVV"
                  inputMode="numeric"
                  type="password"
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value)}
                  className="border-white/10 bg-[#2a2622] text-warm-white"
                />
              </div>
            </div>
          </div>

          {note ? <div className="text-xs leading-relaxed text-warm-white/50">{note}</div> : null}

          <Button
            className="w-full rounded-full uppercase tracking-[0.18em]"
            size="lg"
            disabled={busy}
            type="button"
            onClick={submit}
          >
            {busy ? "Processing…" : `Checkout ${formatMoney(amount, currency)}`}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function PayMethod({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      className={`h-14 gap-1 rounded-xl p-0 normal-case tracking-normal ${
        active ? "border-champagne bg-champagne/10" : ""
      }`}
    >
      {icon}
      <span className="text-sm">{label}</span>
    </Button>
  );
}

function PayPalMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path
        fill="#003087"
        d="M7.2 21.2h2.1l.8-5.1h2.3c3.7 0 5.6-1.8 6.1-5.3.6-3.7-1.2-5.8-4.8-5.8H8.1L6 21.2h1.2z"
      />
      <path
        fill="#009cde"
        d="M9.3 3.1h6.4c2.1 0 3.6.5 4.4 1.6.9 1.2 1 2.9.5 5.1-.8 3.7-3.1 5.6-7 5.6h-2.7L9.3 3.1z"
      />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
      <path d="M16.7 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.2-2.8.9-3.5.9s-1.8-1-3-1c-1.5 0-3 .9-3.7 2.3-1.6 2.8-.4 6.9 1.1 9.2.8 1.1 1.7 2.3 2.9 2.3 1.2 0 1.6-.8 3-.8s1.8.8 3 .8 2-.1 2.9-2.3c.6-1.1 1-2.2 1-2.3-.1 0-1.9-.7-1.9-2.8zM14.9 6.2c.6-.8 1.1-1.9.9-3-1 .1-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1.1.1 2.2-.5 2.9-1.4z" />
    </svg>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.6h5.1c-.2 1.2-.9 2.3-1.9 3l3 2.3c1.8-1.6 2.8-4 2.8-6.9 0-.7-.1-1.3-.2-1.9H12z" />
      <path fill="#34A853" d="M12 21c2.4 0 4.5-.8 6-2.1l-3-2.3c-.8.6-1.9 1-3 1-2.3 0-4.3-1.6-5-3.7L3.8 16c1.5 3 4.6 5 8.2 5z" />
      <path fill="#4A90E2" d="M7 13.9c-.2-.6-.3-1.2-.3-1.9s.1-1.3.3-1.9L3.8 8C3.3 9.1 3 10.5 3 12s.3 2.9.8 4l3.2-2.1z" />
      <path fill="#FBBC05" d="M12 6.5c1.3 0 2.5.5 3.4 1.3l2.5-2.5C16.5 3.8 14.4 3 12 3 8.4 3 5.3 5 3.8 8l3.2 2.1C7.7 8.1 9.7 6.5 12 6.5z" />
    </svg>
  );
}
