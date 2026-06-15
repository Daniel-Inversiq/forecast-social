"use client";

import Link from "next/link";
import {
  creatorAgentActionButtonClass,
  resolveCreatorAgentAction,
  type CreatorAgentActionInput,
} from "@/lib/creatorAgentAction";

export function CreatorAgentActionLink({
  agent,
  className = "",
}: {
  agent: CreatorAgentActionInput;
  className?: string;
}) {
  const action = resolveCreatorAgentAction(agent);
  const style = creatorAgentActionButtonClass(action.key);

  return (
    <div className={className}>
      <Link
        href={action.href}
        className={`w-full text-center text-[11px] font-semibold px-3 py-2 rounded-lg border transition ${style}`}
      >
        {action.label}
      </Link>
      {action.hint && (
        <p className="text-[9px] text-zinc-600 text-center mt-1.5 leading-snug line-clamp-2">
          {action.hint}
        </p>
      )}
    </div>
  );
}
