"use client";

export function SettingsSaveBar({
  dirty,
  saving,
  savedFlash,
  onSave,
  onDiscard,
}: {
  dirty: boolean;
  saving: boolean;
  savedFlash: boolean;
  onSave: () => void;
  onDiscard: () => void;
}) {
  if (!dirty && !savedFlash) return null;

  return (
    <div
      className={`settings-save-bar fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-800/90 bg-zinc-950/95 backdrop-blur-md transition-transform duration-300 ${
        dirty || savedFlash ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <p className="text-[12px] text-zinc-500">
          {savedFlash && !dirty ? (
            <span className="text-emerald-400/90">Settings saved locally</span>
          ) : (
            "Unsaved changes"
          )}
        </p>
        <div className="flex items-center gap-2">
          {dirty && (
            <>
              <button
                type="button"
                onClick={onDiscard}
                disabled={saving}
                className="text-[12px] px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={saving}
                className="text-[12px] px-4 py-1.5 rounded-lg font-medium bg-violet-600 hover:bg-violet-500 text-white transition disabled:opacity-60 disabled:cursor-not-allowed settings-save-btn"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
