import React from "react";
import { createRoot } from "react-dom/client";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
} from "@tanstack/react-query";
import { create } from "zustand";
import axios from "axios";

type WizardStep = "dataset" | "model" | "explainers" | "metrics" | "results";
type Theme = "dark" | "light";

type AppState = {
  step: WizardStep;
  theme: Theme;
  setStep: (step: WizardStep) => void;
  toggleTheme: () => void;
};

type RunResponse = {
  run_id: string;
  status: string;
  config: {
    dataset_id: string;
    model_id: string;
    explainer: string;
    metric: string;
  };
  results: {
    metric: string;
    value: number;
    explainer: string;
  };
};

const API_BASE_URL = "http://127.0.0.1:8000";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10_000,
});

const useAppState = create<AppState>((set) => ({
  step: "dataset",
  theme: "dark",
  setStep: (step) => set({ step }),
  toggleTheme: () =>
    set((state) => ({
      theme: state.theme === "dark" ? "light" : "dark",
    })),
}));

const queryClient = new QueryClient();

function App() {
  const { step, setStep, theme, toggleTheme } = useAppState();
  const steps: WizardStep[] = ["dataset", "model", "explainers", "metrics", "results"];

  const healthQuery = useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const response = await api.get<{ status: string }>("/health");
      return response.data;
    },
  });

  const explainersQuery = useQuery({
    queryKey: ["explainers", "model_mock_001", "ds_mock_001"],
    queryFn: async () => {
      const response = await api.get<{
        explainers: string[];
        metrics: string[];
      }>("/explainers/compatible", {
        params: { model_id: "model_mock_001", dataset_id: "ds_mock_001" },
      });
      return response.data;
    },
  });

  const runMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post<RunResponse>("/runs", {
        dataset_id: "ds_mock_001",
        model_id: "model_mock_001",
        explainer: "lime",
        metric: "comprehensiveness",
      });
      return response.data;
    },
  });

  const isDark = theme === "dark";
  const colors = {
    background: isDark ? "#0b1020" : "#f6f8fc",
    panel: isDark ? "#121a2f" : "#ffffff",
    text: isDark ? "#e6ecff" : "#121212",
    muted: isDark ? "#9fb0d6" : "#5b6170",
    border: isDark ? "#26324f" : "#d9deea",
    accent: isDark ? "#7aa2ff" : "#2447d5",
    activeButton: isDark ? "#2b4bb4" : "#2447d5",
  };

  return (
    <main
      style={{
        fontFamily: "Inter, sans-serif",
        padding: 24,
        minHeight: "100vh",
        background: colors.background,
        color: colors.text,
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
              cursor: "pointer",
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
                cursor: "pointer",
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
            background: colors.panel,
            marginBottom: 12,
          }}
        >
          <h2 style={{ marginTop: 0 }}>Current step: {step}</h2>
          <p style={{ color: colors.muted, marginBottom: 0 }}>
            Next: connect this step to full dataset/model execution state.
          </p>
        </section>

        <section
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: 10,
            padding: 16,
            background: colors.panel,
          }}
        >
          <h3 style={{ marginTop: 0 }}>Live API integration check</h3>
          <p style={{ margin: "4px 0", color: colors.muted }}>
            API base URL: <code>{API_BASE_URL}</code>
          </p>
          <p style={{ margin: "4px 0" }}>
            Health: {healthQuery.isLoading ? "loading..." : healthQuery.data?.status ?? "unavailable"}
          </p>
          <p style={{ margin: "4px 0" }}>
            Compatible explainers: {explainersQuery.data?.explainers.join(", ") ?? "loading..."}
          </p>
          <p style={{ margin: "4px 0" }}>
            Suggested metrics: {explainersQuery.data?.metrics.join(", ") ?? "loading..."}
          </p>
          <button
            onClick={() => runMutation.mutate()}
            disabled={runMutation.isPending}
            style={{
              marginTop: 10,
              padding: "8px 12px",
              borderRadius: 8,
              border: `1px solid ${colors.border}`,
              background: colors.activeButton,
              color: "white",
              cursor: "pointer",
            }}
          >
            {runMutation.isPending ? "Running..." : "Run sample experiment"}
          </button>

          {runMutation.data ? (
            <pre
              style={{
                marginTop: 12,
                border: `1px solid ${colors.border}`,
                borderRadius: 8,
                padding: 12,
                background: isDark ? "#0d1529" : "#f8f9fd",
                color: colors.muted,
                overflowX: "auto",
              }}
            >
              {JSON.stringify(runMutation.data, null, 2)}
            </pre>
          ) : null}
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
  </React.StrictMode>,
);
