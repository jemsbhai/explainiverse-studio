import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { create } from "zustand";

type WizardStep = "dataset" | "model" | "explainers" | "metrics" | "results";
type Theme = "dark" | "light";

type AppState = {
  step: WizardStep;
  theme: Theme;
  setStep: (step: WizardStep) => void;
  toggleTheme: () => void;
};

const useAppState = create<AppState>((set) => ({
  step: "dataset",
  theme: "dark",
  setStep: (step) => set({ step }),
  toggleTheme: () =>
    set((state) => ({
      theme: state.theme === "dark" ? "light" : "dark"
    }))
}));

const queryClient = new QueryClient();

function App() {
  const { step, setStep, theme, toggleTheme } = useAppState();
  const steps: WizardStep[] = ["dataset", "model", "explainers", "metrics", "results"];

  const isDark = theme === "dark";
  const colors = {
    background: isDark ? "#0b1020" : "#f6f8fc",
    panel: isDark ? "#121a2f" : "#ffffff",
    text: isDark ? "#e6ecff" : "#121212",
    muted: isDark ? "#9fb0d6" : "#5b6170",
    border: isDark ? "#26324f" : "#d9deea",
    accent: isDark ? "#7aa2ff" : "#2447d5",
    activeButton: isDark ? "#2b4bb4" : "#2447d5"
  };

  return (
    <main
      style={{
        fontFamily: "Inter, sans-serif",
        padding: 24,
        minHeight: "100vh",
        background: colors.background,
        color: colors.text
      }}
    >
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <h1 style={{ marginBottom: 8 }}>Explainiverse Studio</h1>
            <p style={{ marginTop: 0, color: colors.muted }}>Scaffolded MVP workflow shell</p>
          </div>
          <button
            onClick={toggleTheme}
            style={{
              borderRadius: 999,
              border: `1px solid ${colors.border}`,
              background: colors.panel,
              color: colors.text,
              padding: "8px 14px",
              cursor: "pointer"
            }}
          >
            {isDark ? "Switch to light" : "Switch to dark"}
          </button>
        </header>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {steps.map((s) => (
            <button
              key={s}
              onClick={() => setStep(s)}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: `1px solid ${colors.border}`,
                background: s === step ? colors.activeButton : colors.panel,
                color: s === step ? "#ffffff" : colors.text,
                cursor: "pointer"
              }}
            >
              {s}
            </button>
          ))}
        </div>

        <section
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: 10,
            padding: 16,
            background: colors.panel
          }}
        >
          <h2 style={{ marginTop: 0 }}>Current step: {step}</h2>
          <p style={{ color: colors.muted, marginBottom: 0 }}>
            Next: connect this step to API endpoints and persisted experiment state.
          </p>
          <p style={{ color: colors.accent, marginTop: 12, marginBottom: 0 }}>
            Default theme is dark mode.
          </p>
        </section>
      </div>
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
