import React, { ChangeEvent, useEffect, useState } from "react";
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

type DatasetResponse = {
  dataset_id: string;
  filename: string;
  rows: number;
  columns: string[];
  preview: Record<string, string | number | null>[];
  dtypes: Record<string, string>;
  missing_values: Record<string, number>;
};

type ModelResponse = {
  model_id: string;
  dataset_id: string;
  model_type: string;
  status: string;
};

type CompatibilityResponse = {
  explainers: string[];
  metrics: string[];
  target_column: string;
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
    target_column: string;
    dataset_rows: number;
  };
};

type RunHistoryItem = {
  run_id: string;
  dataset_id: string;
  model_id: string;
  explainer: string;
  metric: string;
  score: number;
};

const API_BASE_URL = "http://127.0.0.1:8000";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10_000,
});

const SAMPLE_CSV = `target,feature_a,feature_b
1,0.2,1.2
0,0.5,0.7
1,0.9,1.8
0,0.1,0.3
`;

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

  const [dataset, setDataset] = useState<DatasetResponse | null>(null);
  const [model, setModel] = useState<ModelResponse | null>(null);
  const [targetColumn, setTargetColumn] = useState<string>("target");
  const [selectedExplainer, setSelectedExplainer] = useState<string>("lime");
  const [selectedMetric, setSelectedMetric] = useState<string>("comprehensiveness");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const healthQuery = useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const response = await api.get<{ status: string }>("/health");
      return response.data;
    },
  });

  const runHistoryQuery = useQuery({
    queryKey: ["run-history"],
    queryFn: async () => {
      const response = await api.get<{ runs: RunHistoryItem[] }>("/runs");
      return response.data.runs;
    },
  });

  const uploadDatasetMutation = useMutation({
    mutationFn: async (file: File) => {
      const data = new FormData();
      data.append("file", file);
      const response = await api.post<DatasetResponse>("/datasets", data);
      return response.data;
    },
    onSuccess: (response) => {
      setDataset(response);
      setModel(null);
      setTargetColumn(response.columns[0] ?? "target");
      setErrorMessage(null);
    },
    onError: () => setErrorMessage("Dataset upload failed."),
  });

  const trainModelMutation = useMutation({
    mutationFn: async () => {
      if (!dataset) {
        throw new Error("Upload a dataset first");
      }
      const response = await api.post<ModelResponse>("/models/train", {
        dataset_id: dataset.dataset_id,
        target_column: targetColumn,
        model_type: "random_forest",
      });
      return response.data;
    },
    onSuccess: (response) => {
      setModel(response);
      setErrorMessage(null);
    },
    onError: () => setErrorMessage("Model training failed. Check target column."),
  });

  const explainersQuery = useQuery({
    queryKey: ["explainers", model?.model_id, dataset?.dataset_id],
    enabled: Boolean(model?.model_id && dataset?.dataset_id),
    queryFn: async () => {
      const response = await api.get<CompatibilityResponse>("/explainers/compatible", {
        params: { model_id: model?.model_id, dataset_id: dataset?.dataset_id },
      });
      return response.data;
    },
  });

  useEffect(() => {
    if (explainersQuery.data?.explainers.length) {
      setSelectedExplainer(explainersQuery.data.explainers[0]);
    }
    if (explainersQuery.data?.metrics.length) {
      setSelectedMetric(explainersQuery.data.metrics[0]);
    }
  }, [explainersQuery.data]);

  const runMutation = useMutation({
    mutationFn: async () => {
      if (!dataset || !model) {
        throw new Error("Upload dataset and train model first");
      }
      const response = await api.post<RunResponse>("/runs", {
        dataset_id: dataset.dataset_id,
        model_id: model.model_id,
        explainer: selectedExplainer,
        metric: selectedMetric,
      });
      return response.data;
    },
    onSuccess: async () => {
      await runHistoryQuery.refetch();
      setErrorMessage(null);
    },
    onError: () => setErrorMessage("Run failed. Confirm model + dataset are ready."),
  });

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
  };

  const uploadSelectedFile = () => {
    if (!selectedFile) {
      setErrorMessage("Select a CSV file first.");
      return;
    }
    uploadDatasetMutation.mutate(selectedFile);
  };

  const uploadSampleFile = () => {
    const file = new File([SAMPLE_CSV], "sample.csv", { type: "text/csv" });
    uploadDatasetMutation.mutate(file);
  };

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
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
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

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
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

            <div style={{ marginTop: 12, marginBottom: 8 }}>
              <label>
                Upload CSV:&nbsp;
                <input type="file" accept=".csv,text/csv" onChange={onFileChange} />
              </label>
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <button
                  onClick={uploadSelectedFile}
                  disabled={uploadDatasetMutation.isPending}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: `1px solid ${colors.border}`,
                    background: colors.activeButton,
                    color: "white",
                    cursor: "pointer",
                  }}
                >
                  Upload selected file
                </button>
                <button
                  onClick={uploadSampleFile}
                  disabled={uploadDatasetMutation.isPending}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: `1px solid ${colors.border}`,
                    background: colors.activeButton,
                    color: "white",
                    cursor: "pointer",
                  }}
                >
                  1) Upload sample dataset
                </button>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              <button
                onClick={() => trainModelMutation.mutate()}
                disabled={!dataset || trainModelMutation.isPending}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: `1px solid ${colors.border}`,
                  background: colors.activeButton,
                  color: "white",
                  cursor: "pointer",
                }}
              >
                {trainModelMutation.isPending ? "Training..." : "2) Train model"}
              </button>

              <button
                onClick={() => runMutation.mutate()}
                disabled={!dataset || !model || runMutation.isPending}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: `1px solid ${colors.border}`,
                  background: colors.activeButton,
                  color: "white",
                  cursor: "pointer",
                }}
              >
                {runMutation.isPending ? "Running..." : "3) Run experiment"}
              </button>
            </div>

            {dataset ? (
              <div style={{ marginTop: 12, borderTop: `1px solid ${colors.border}`, paddingTop: 12 }}>
                <p style={{ margin: "4px 0" }}>
                  Dataset: {dataset.dataset_id} ({dataset.rows} rows) from <strong>{dataset.filename}</strong>
                </p>
                <label>
                  Target column:&nbsp;
                  <select
                    value={targetColumn}
                    onChange={(event) => setTargetColumn(event.target.value)}
                    style={{ background: colors.panel, color: colors.text, border: `1px solid ${colors.border}` }}
                  >
                    {dataset.columns.map((column) => (
                      <option key={column} value={column}>
                        {column}
                      </option>
                    ))}
                  </select>
                </label>
                <details style={{ marginTop: 8 }}>
                  <summary>Dataset preview / schema</summary>
                  <pre
                    style={{
                      border: `1px solid ${colors.border}`,
                      borderRadius: 8,
                      padding: 12,
                      background: isDark ? "#0d1529" : "#f8f9fd",
                      color: colors.muted,
                      overflowX: "auto",
                    }}
                  >
                    {JSON.stringify(
                      {
                        columns: dataset.columns,
                        dtypes: dataset.dtypes,
                        missing_values: dataset.missing_values,
                        preview: dataset.preview,
                      },
                      null,
                      2,
                    )}
                  </pre>
                </details>
              </div>
            ) : (
              <p style={{ margin: "8px 0 4px" }}>Dataset: not uploaded</p>
            )}

            <p style={{ margin: "4px 0" }}>
              Model: {model ? `${model.model_id} (${model.model_type})` : "not trained"}
            </p>

            {explainersQuery.data ? (
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
                <label>
                  Explainer:&nbsp;
                  <select
                    value={selectedExplainer}
                    onChange={(event) => setSelectedExplainer(event.target.value)}
                    style={{ background: colors.panel, color: colors.text, border: `1px solid ${colors.border}` }}
                  >
                    {explainersQuery.data.explainers.map((explainer) => (
                      <option key={explainer} value={explainer}>
                        {explainer}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Metric:&nbsp;
                  <select
                    value={selectedMetric}
                    onChange={(event) => setSelectedMetric(event.target.value)}
                    style={{ background: colors.panel, color: colors.text, border: `1px solid ${colors.border}` }}
                  >
                    {explainersQuery.data.metrics.map((metric) => (
                      <option key={metric} value={metric}>
                        {metric}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : (
              <>
                <p style={{ margin: "4px 0" }}>Compatible explainers: train model first</p>
                <p style={{ margin: "4px 0" }}>Suggested metrics: train model first</p>
              </>
            )}

            {errorMessage ? <p style={{ color: "#ff8a8a", marginTop: 12 }}>{errorMessage}</p> : null}

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

          <aside
            style={{
              border: `1px solid ${colors.border}`,
              borderRadius: 10,
              padding: 16,
              background: colors.panel,
              height: "fit-content",
            }}
          >
            <h3 style={{ marginTop: 0 }}>Run history</h3>
            {!runHistoryQuery.data?.length ? (
              <p style={{ color: colors.muted }}>No runs yet.</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
                {runHistoryQuery.data.map((run) => (
                  <li
                    key={run.run_id}
                    style={{ border: `1px solid ${colors.border}`, borderRadius: 8, padding: 10 }}
                  >
                    <div style={{ fontWeight: 600 }}>{run.run_id}</div>
                    <div style={{ color: colors.muted, fontSize: 13 }}>
                      {run.explainer} • {run.metric}
                    </div>
                    <div style={{ color: colors.muted, fontSize: 13 }}>
                      dataset {run.dataset_id} • model {run.model_id}
                    </div>
                    <div style={{ marginTop: 4 }}>score: {run.score.toFixed(2)}</div>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
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
