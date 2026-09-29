// Tiny pub-sub so the chat assistant can drive the waifu without prop drilling.
type Handler = (text: string) => void;

const sayHandlers = new Set<Handler>();

export function onWaifuSay(h: Handler): () => void {
  sayHandlers.add(h);
  return () => sayHandlers.delete(h);
}

export function waifuSay(text: string): void {
  for (const h of sayHandlers) h(text);
}
