export class WebSocketServer {
  clients = new Set();
  constructor(_opts?: { port: number }) {}
  on(_event: string, _cb: (...args: unknown[]) => void) {}
}

export class WebSocket {
  static OPEN = 1;
  readyState = 0;
  send(_data: string) {}
  close() {}
  on() {}
}
