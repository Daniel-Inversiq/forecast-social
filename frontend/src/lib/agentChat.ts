/** Agent ask/chat — enable when `/agents/[slug]/ask` (or API) ships. */
export function isAgentChatAvailable(): boolean {
  return process.env.NEXT_PUBLIC_AGENT_CHAT_ENABLED?.trim().toLowerCase() === "true";
}

export function agentAskLabel(agentName: string): string {
  return `Ask ${agentName}`;
}

export function agentChatHref(slug: string): string {
  return `/agents/${slug}/ask`;
}
