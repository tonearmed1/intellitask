import { useNavigate } from "react-router-dom";
import { Button } from "@/components/Button";

const SAMPLE_PROMPTS = [
  "Prepare for EICMA",
  "Organise our company Christmas party",
  "Launch a new website",
  "Plan a 10-day trip to Japan",
  "Prepare for an investor meeting",
  "Renovate the kitchen",
];

export default function OnboardingPage({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();

  function startWith(prompt?: string) {
    onDone();
    navigate(prompt ? `/projects?new=ai&title=${encodeURIComponent(prompt)}` : "/projects?new=ai");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 dark:bg-neutral-950">
      <div className="w-full max-w-lg text-center">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
          Welcome to Intellitask
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          Tell the app what you want to achieve. It will work out what needs to happen — the
          workstreams, tasks, and details you'd otherwise have to think through yourself.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {SAMPLE_PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => startWith(p)}
              className="rounded-lg border border-neutral-200 bg-white px-4 py-3 text-left text-sm text-neutral-700 shadow-sm transition-colors hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              {p}
            </button>
          ))}
        </div>

        <div className="mt-8 flex justify-center gap-3">
          <Button variant="ghost" onClick={onDone}>
            Skip for now
          </Button>
          <Button variant="primary" onClick={() => startWith()}>
            Get started
          </Button>
        </div>
      </div>
    </div>
  );
}
