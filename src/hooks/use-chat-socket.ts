"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { readJson } from "@/lib/http";
import type { ChatSocketEvent } from "@/lib/chat-types";

/** Subscribes to live chat events. Returns whether the socket is currently connected. */
export function useChatSocket(
  onEvent: (event: ChatSocketEvent) => void,
  options: { as?: "admin" | "staff" | "member" } = {},
) {
  const handleEvent = useEffectEvent(onEvent);
  const [connected, setConnected] = useState(false);
  const as = options.as;

  useEffect(() => {
    let socket: WebSocket | null = null;
    let closed = false;
    let retry: number | undefined;

    function scheduleRetry() {
      if (closed) return;
      retry = window.setTimeout(() => void connect(), 2500);
    }

    async function connect() {
      const res = await fetch(`/api/chat/ticket${as && as !== "admin" ? `?as=${as}` : ""}`).catch(() => null);
      const data = res ? await readJson<{ ticket?: string; wsPort?: number }>(res) : null;
      if (closed) return;
      if (!res?.ok || !data?.ticket) {
        if (res && res.status !== 401) scheduleRetry();
        return;
      }
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const port = data.wsPort || 3001;
      const ws = new WebSocket(`${protocol}//${window.location.hostname}:${port}`);
      socket = ws;
      ws.addEventListener("open", () => {
        ws.send(JSON.stringify({ type: "hello", ticket: data.ticket }));
      });
      ws.addEventListener("message", (event) => {
        try {
          const parsed = JSON.parse(String(event.data)) as ChatSocketEvent | { type: "ready" };
          if (parsed.type === "ready") {
            setConnected(true);
            return;
          }
          handleEvent(parsed);
        } catch {
          /* ignore */
        }
      });
      ws.addEventListener("close", () => {
        setConnected(false);
        scheduleRetry();
      });
      ws.addEventListener("error", () => {
        ws.close();
      });
    }

    void connect();
    return () => {
      closed = true;
      if (retry) window.clearTimeout(retry);
      socket?.close();
    };
  }, [as]);

  return connected;
}
