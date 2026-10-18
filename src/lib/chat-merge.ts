import type { ChatLineDto, ChatThreadDto } from "@/lib/chat-types";

const WELCOME = "Your request is accepted. How may the desk assist you?";

export function uniqueLines(lines: ChatLineDto[] | undefined | null): ChatLineDto[] {
  const seen = new Set<string>();
  const out: ChatLineDto[] = [];
  for (const line of lines || []) {
    if (!line?.id || seen.has(line.id)) continue;
    const last = out[out.length - 1];
    if (
      last &&
      last.sender === line.sender &&
      last.body === line.body &&
      line.body === WELCOME
    ) {
      continue;
    }
    seen.add(line.id);
    out.push(line);
  }
  return out;
}

export function mergeThread(
  current: ChatThreadDto | null | undefined,
  incoming: ChatThreadDto,
): ChatThreadDto {
  const previous = current?.id === incoming.id ? current.messages : undefined;
  return {
    ...incoming,
    messages: uniqueLines([...(previous || []), ...(incoming.messages || [])]),
  };
}

export function appendLine(
  lines: ChatLineDto[] | undefined,
  line: ChatLineDto,
): ChatLineDto[] {
  return uniqueLines([...(lines || []), line]);
}
