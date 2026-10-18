export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startChatSocket } = await import("@/lib/chat-socket");
  startChatSocket();
}
