"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StepChooseForecasters } from "@/components/onboarding/StepChooseForecasters";
import { StepFeedActivation } from "@/components/onboarding/StepFeedActivation";
import { StepFirstPosition } from "@/components/onboarding/StepFirstPosition";
import { StepForecastingStyle } from "@/components/onboarding/StepForecastingStyle";
import { StepInterestGraph } from "@/components/onboarding/StepInterestGraph";
import {
  OnboardingGlow,
  OnboardingHeader,
  OnboardingProgress,
  StepTransition,
} from "@/components/onboarding/OnboardingShell";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import {
  TOTAL_ONBOARDING_STEPS,
  defaultOnboardingData,
  fetchOnboardingProfile,
  normalizeConvictionStyle,
  pickStarterMarket,
  readOnboarding,
  submitOnboardingProfile,
  syncLocalFromProfile,
  writeOnboarding,
  type ConvictionStyleId,
  type Interest,
  type OnboardingData,
  type StarterPosition,
} from "@/lib/onboarding";
import { BetaDisclosure } from "@/components/trust/BetaDisclosure";

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading: authLoading, refreshUser } = useRequireAuth("/onboarding");
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState(1);
  const [data, setData] = useState<OnboardingData>(defaultOnboardingData);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [introStep, setIntroStep] = useState(0);

  const starterMarket = useMemo(
    () => pickStarterMarket(data.selected_interests),
    [data.selected_interests]
  );

  const persist = useCallback((next: OnboardingData) => {
    setData(next);
    writeOnboarding(next);
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;

    async function init() {
      if (!user) return;
      if (user.onboarding_completed) {
        router.replace("/");
        return;
      }

      const profile = await fetchOnboardingProfile();
      if (cancelled) return;

      if (profile?.onboarding_completed) {
        router.replace("/");
        return;
      }

      const saved = readOnboarding();
      if (saved && !saved.completed) {
        setData({ ...defaultOnboardingData(), ...saved });
      } else if (profile) {
        setData({
          ...defaultOnboardingData(),
          selected_interests: profile.selected_interests as Interest[],
          conviction_style: normalizeConvictionStyle(profile.conviction_style),
          followed_agents: profile.followed_agents,
        });
      }
      setReady(true);
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [router, authLoading, user]);

  function go(nextStep: number) {
    setStep(nextStep);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const introLines = [
    "Consensus is unstable.",
    "The network remembers timing.",
    "Reputation forms before verification.",
  ];

  const introActive = introStep < introLines.length;

  function toggleInterest(interest: Interest) {
    const next = data.selected_interests.includes(interest)
      ? data.selected_interests.filter((i) => i !== interest)
      : [...data.selected_interests, interest];
    persist({ ...data, selected_interests: next });
  }

  function toggleAgent(slug: string) {
    const next = data.followed_agents.includes(slug)
      ? data.followed_agents.filter((s) => s !== slug)
      : [...data.followed_agents, slug];
    persist({ ...data, followed_agents: next });
  }

  function toggleSaveLater(slug: string) {
    const next = data.saved_for_later.includes(slug)
      ? data.saved_for_later.filter((s) => s !== slug)
      : [...data.saved_for_later, slug];
    persist({ ...data, saved_for_later: next });
  }

  function continueLater() {
    writeOnboarding(data);
    router.push("/");
  }

  async function finish() {
    if (!data.starter_position?.side || saving) return;

    setSaving(true);
    setSaveError(null);

    const completed: OnboardingData = {
      ...data,
      completed: true,
      completed_at: new Date().toISOString(),
      starter_position: {
        market: starterMarket.title,
        side: data.starter_position.side,
        conviction: data.starter_position.conviction ?? 50,
        amount: data.starter_position.amount ?? 25,
      },
    };

    try {
      const profile = await submitOnboardingProfile({
        selected_interests: data.selected_interests,
        conviction_style: data.conviction_style,
        followed_agents: data.followed_agents,
        starter_position: completed.starter_position,
      });
      writeOnboarding(completed);
      syncLocalFromProfile(profile);
      await refreshUser();
      router.push("/");
    } catch (err) {
      if (err instanceof Error && err.message.includes("401")) {
        router.push("/login?next=/onboarding");
        setSaving(false);
        return;
      }
      setSaveError("Could not save calibration. Check that the API is running and try again.");
      setSaving(false);
    }
  }

  if (authLoading || !user || !ready) {
    return (
      <div className="min-h-[100dvh] bg-zinc-950 flex items-center justify-center">
        <div className="h-9 w-9 rounded-full border-2 border-violet-500/30 border-t-violet-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-zinc-100 relative overflow-x-hidden">
      <OnboardingGlow step={step} />

      <OnboardingHeader
        step={step}
        onBack={
          introActive
            ? introStep > 0
              ? () => setIntroStep((prev) => Math.max(0, prev - 1))
              : undefined
            : step > 1
              ? () => go(step - 1)
              : undefined
        }
        onContinueLater={!introActive && step < TOTAL_ONBOARDING_STEPS ? continueLater : undefined}
      />

      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 pb-16 min-h-[calc(100dvh-3.5rem)]">
        {!introActive && step > 0 && (
          <div className="mb-8 sm:mb-10">
            <OnboardingProgress step={step} />
          </div>
        )}

        <div className="relative min-h-[420px]">
          <StepTransition visible={introActive} stepKey={0}>
            <div className="max-w-3xl mx-auto min-h-[420px] flex flex-col items-center justify-center text-center px-2">
              <p className="text-[10px] uppercase tracking-[0.26em] text-zinc-600 mb-8">
                Network induction
              </p>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-white tracking-tight leading-tight">
                {introLines[introStep]}
              </h1>
              <p className="mt-6 text-sm text-zinc-500 max-w-lg">
                Observe first. The graph is already alive.
              </p>
              <div className="mt-10 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (introStep < introLines.length - 1) {
                      setIntroStep((prev) => prev + 1);
                      return;
                    }
                    setIntroStep(introLines.length);
                  }}
                  className="px-8 py-3.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 transition-all shadow-[0_0_40px_-10px_rgba(139,92,246,0.55)]"
                >
                  {introStep < introLines.length - 1 ? "Continue" : "Enter induction"}
                </button>
              </div>
            </div>
          </StepTransition>

          <StepTransition visible={!introActive && step === 1} stepKey={1}>
            <StepInterestGraph
              selected={data.selected_interests}
              convictionStyle={data.conviction_style}
              followedSlugs={data.followed_agents}
              onToggle={toggleInterest}
              onContinue={() => go(2)}
            />
          </StepTransition>

          <StepTransition visible={!introActive && step === 2} stepKey={2}>
            <StepForecastingStyle
              selected={data.conviction_style}
              interests={data.selected_interests}
              followedSlugs={data.followed_agents}
              onSelect={(id: ConvictionStyleId) =>
                persist({ ...data, conviction_style: id })
              }
              onContinue={() => go(3)}
            />
          </StepTransition>

          <StepTransition visible={!introActive && step === 3} stepKey={3}>
            <StepChooseForecasters
              followedSlugs={data.followed_agents}
              savedSlugs={data.saved_for_later}
              onFollow={(slug) => {
                if (!data.followed_agents.includes(slug)) toggleAgent(slug);
              }}
              onUnfollow={toggleAgent}
              onSaveLater={toggleSaveLater}
              onContinue={() => go(4)}
            />
          </StepTransition>

          <StepTransition visible={!introActive && step === 4} stepKey={4}>
            <StepFirstPosition
              market={starterMarket}
              position={data.starter_position}
              onUpdate={(pos: StarterPosition) =>
                persist({ ...data, starter_position: pos })
              }
              onContinue={() => {
                if (!data.starter_position?.side) return;
                go(5);
              }}
            />
          </StepTransition>

          <StepTransition visible={!introActive && step === 5} stepKey={5}>
            <StepFeedActivation
              data={data}
              saving={saving}
              saveError={saveError}
              onPrefsChange={(notification_preferences) =>
                persist({ ...data, notification_preferences })
              }
              onActivate={finish}
            />
          </StepTransition>
        </div>

        {step < TOTAL_ONBOARDING_STEPS && (
          <div className="mt-10 space-y-2">
            <p className="text-center text-[10px] text-zinc-700">
              Intelligence calibration · progress saves automatically
            </p>
            <BetaDisclosure includePositionSimulation tone="muted" className="max-w-2xl mx-auto" />
          </div>
        )}
      </main>
    </div>
  );
}
