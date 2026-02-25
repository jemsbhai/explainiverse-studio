import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { create } from "zustand";

type WizardStep = "dataset" | "model" | "explainers" | "metrics" | "results";

type AppState = {
  step: WizardStep;
  setStep: (step: WizardStep) => void;
};

const useAppState = create<AppState>((set) => ({
  step: "dataset",
  setStep: (step) => set({ step })
}));

const queryClient = new QueryClient();

function App() {
  const { step, setStep } = useAppState();
  const steps: WizardStep[] = ["dataset", "model", "explainers", "metrics", "results"];

  return (
    <main style={{ fontFamily: "Inter, sans-serif", padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1>Explainiverse Studio</h1>
      <p>Scaffolded MVP workflow shell</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {steps.map((s) => (
          <button
            key={s}
            onClick={() => setStep(s)}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #ddd",
              background: s === step ? "#111" : "#fff",
              color: s === step ? "#fff" : "#111",
              cursor: "pointer"
            }}
          >
            {s}
          </button>
        ))}
      </div>
      <section style={{ border: "1px solid #eee", borderRadius: 10, padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>Current step: {step}</h2>
        <p>Next: connect this step to API endpoints and persisted experiment state.</p>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
