"use client";

import { ChatHeader } from "@/components/assistance/chat-header";
import { MessageList, type ChatMessage } from "@/components/assistance/message-list";
import { ChatInput } from "@/components/assistance/chat-input";

export function ChatPanel({
  messages,
  typing,
  onSend,
  onClose,
}: {
  messages: ChatMessage[];
  typing: boolean;
  onSend: (text: string, files: File[]) => void;
  onClose: () => void;
}) {
  return (
    <div className="flex h-[min(72vh,620px)] w-[min(92vw,400px)] flex-col overflow-hidden rounded-[22px] border border-[#7267ef]/20 bg-white shadow-[0_28px_80px_rgba(114,103,239,0.16)] max-sm:fixed max-sm:inset-3 max-sm:h-auto max-sm:w-auto">
      <ChatHeader onClose={onClose} />
      <MessageList messages={messages} typing={typing} />
      <ChatInput onSend={onSend} disabled={typing} />
    </div>
  );
}
