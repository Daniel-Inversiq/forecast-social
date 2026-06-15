"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { feedLoadLog } from "@/lib/feedLoadLog";

type Props = {
  itemId: string;
  children: ReactNode;
};

type State = {
  error: Error | null;
};

export class FeedItemErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    feedLoadLog("FeedItemErrorBoundary", {
      itemId: this.props.itemId,
      message: error.message,
      componentStack: info.componentStack?.slice(0, 240),
    });
  }

  render() {
    if (this.state.error) {
      return (
        <div
          className="feed-post-card border border-rose-500/25 bg-rose-950/20 px-3 py-2.5 rounded-lg"
          data-feed-item-error={this.props.itemId}
        >
          <p className="text-[11px] font-medium text-rose-300/90">Could not render feed item</p>
          <p className="text-[10px] text-rose-200/70 mt-0.5 break-all">{this.props.itemId}</p>
          <p className="text-[10px] text-zinc-500 mt-1 line-clamp-2">{this.state.error.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
