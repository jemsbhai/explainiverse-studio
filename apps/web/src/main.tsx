import React, { ChangeEvent, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider, useMutation, useQuery } from "@tanstack/react-query";
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
  task_type: string;
  feature_count: number;
  status: string;
  framework?: string;
  artifact_uri?: string;
};

type DatasetCatalogItem = {
  dataset_id: string;
  filename: string;
  rows: number;
  columns: string[];
  target_column?: string | null;
};

type ModelCatalogItem = {
  model_id: string;
  dataset_id: string;
  target_column: string;
  model_type: string;
  task_type: string;
  framework?: string;
  artifact_uri?: string;
};

type ImageManifestResponse = {
  manifest_id: string;
  status: string;
  phase: string;
  name: string;
  image_count: number;
  class_labels: string[];
  image_root_uri: string;
};

type UploadedModelResponse = {
  model_id: string;
  dataset_id: string;
  status: string;
  model_type: string;
  task_type: string;
  framework: string;
  artifact_uri: string;
  phase: string;
};

type SaliencyPreviewResponse = {
  status: string;
  phase: string;
  model_id: string;
  manifest_id: string;
  sample_ref: string;
  method: string;
  generated_at: string;
  artifact: { artifact_key: string; overlay_uri: string; heatmap_stats: { min: number; max: number; mean: number } };
};

type Phase2BatchCreateResponse = {
  job_id: string;
  status: string;
  phase: string;
  poll_url: string;
  progress: { completed: number; total: number };
};

type Phase2BatchJob = {
  job_id: string;
  model_id: string;
  manifest_id: string;
  status: string;
  progress: { completed: number; total: number };
  created_at: string;
  updated_at: string;
  results: { explainer: string; metric: string; score: number; status: string }[];
};

type CatalogItem = { key: string; label: string; description: string };

type CompatibilityResponse = {
  explainers: string[];
  metrics: string[];
  target_column: string;
  model_type: string;
  explainer_details: (CatalogItem & { supported_model_types: string[] })[];
  metric_details: CatalogItem[];
};

type RunResponse = {
  run_id: string;
  status: string;
  config: { dataset_id: string; model_id: string; explainer: string; metric: string };
  results: {
    metric: string;
    value: number;
    explainer: string;
    target_column: string;
    dataset_rows: number;
    scoring_mode: string;
  };
};

type RunHistoryItem = {
  run_id: string;
  dataset_id: string;
  model_id: string;
  explainer: string;
  metric: string;
  score: number;
  created_at: string;
};

type LeaderboardRow = {
  explainer: string;
  metric: string;
  count: number;
  avg_score: number;
  best_score: number;
  last_run_at: string;
};

type RunSummary = {
  total_runs: number;
  unique_explainers: number;
  unique_metrics: number;
  best_run: { run_id: string; explainer: string; metric: string; score: number } | null;
  latest_run: { run_id: string; created_at: string } | null;
};

type RunReport = {
  generated_at: string;
  summary: RunSummary;
  leaderboard: LeaderboardRow[];
  runs: RunHistoryItem[];
  metadata: { scoring_mode: string; store_mode: string };
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";
const api = axios.create({ baseURL: API_BASE_URL, timeout: 10_000 });
const SAMPLE_CSV = `target,feature_a,feature_b\n1,0.2,1.2\n0,0.5,0.7\n1,0.9,1.8\n0,0.1,0.3\n`;

const useAppState = create<AppState>((set) => ({
  step: "dataset",
  theme: "dark",
  setStep: (step) => set({ step }),
  toggleTheme: () => set((state) => ({ theme: state.theme === "dark" ? "light" : "dark" })),
}));

const queryClient = new QueryClient();

function App() {
  const { step, setStep, theme, toggleTheme } = useAppState();
  const steps: WizardStep[] = ["dataset", "model", "explainers", "metrics", "results"];

  const [dataset, setDataset] = useState<DatasetResponse | null>(null);
  const [model, setModel] = useState<ModelResponse | null>(null);
  const [targetColumn, setTargetColumn] = useState("target");
  const [modelType, setModelType] = useState("random_forest");
  const [selectedExplainer, setSelectedExplainer] = useState("lime");
  const [selectedMetric, setSelectedMetric] = useState("comprehensiveness");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [imageManifestName, setImageManifestName] = useState("demo-images");
  const [imageCount, setImageCount] = useState(3);
  const [imageClasses, setImageClasses] = useState("cat,dog");
  const [imageRootUri, setImageRootUri] = useState("s3://demo/images");
  const [artifactUri, setArtifactUri] = useState("s3://models/model.pt");
  const [sampleRef, setSampleRef] = useState("sample_001.png");
  const [manifest, setManifest] = useState<ImageManifestResponse | null>(null);
  const [uploadedModel, setUploadedModel] = useState<UploadedModelResponse | null>(null);
  const [saliencyPreview, setSaliencyPreview] = useState<SaliencyPreviewResponse | null>(null);
  const [batchExplainers, setBatchExplainers] = useState("saliency,gradcam");
  const [batchMetrics, setBatchMetrics] = useState("comprehensiveness,sufficiency");
  const [batchJob, setBatchJob] = useState<Phase2BatchJob | null>(null);

  const isDark = theme === "dark";
  const colors = {
    background: isDark ? "#0b1020" : "#f6f8fc",
    panel: isDark ? "#121a2f" : "#ffffff",
    text: isDark ? "#e6ecff" : "#121212",
    muted: isDark ? "#9fb0d6" : "#5b6170",
    border: isDark ? "#26324f" : "#d9deea",
    accent: isDark ? "#7aa2ff" : "#2447d5",
  };

  const healthQuery = useQuery({ queryKey: ["health"], queryFn: async () => (await api.get<{ status: string }>("/health")).data });
  const runHistoryQuery = useQuery({ queryKey: ["run-history"], queryFn: async () => (await api.get<{ runs: RunHistoryItem[] }>("/runs")).data.runs });
  const runSummaryQuery = useQuery({ queryKey: ["run-summary"], queryFn: async () => (await api.get<RunSummary>("/runs/summary")).data });
  const leaderboardQuery = useQuery({ queryKey: ["run-leaderboard"], queryFn: async () => (await api.get<{ rows: LeaderboardRow[] }>("/runs/leaderboard")).data.rows });
  const datasetsCatalogQuery = useQuery({ queryKey: ["datasets-catalog"], queryFn: async () => (await api.get<{ datasets: DatasetCatalogItem[] }>("/datasets")).data.datasets });
  const modelsCatalogQuery = useQuery({ queryKey: ["models-catalog"], queryFn: async () => (await api.get<{ models: ModelCatalogItem[] }>("/models")).data.models });

  const explainersQuery = useQuery({
    queryKey: ["explainers", model?.model_id, dataset?.dataset_id],
    enabled: Boolean(model?.model_id && dataset?.dataset_id),
    queryFn: async () => (await api.get<CompatibilityResponse>("/explainers/compatible", { params: { model_id: model?.model_id, dataset_id: dataset?.dataset_id } })).data,
  });

  const refreshRunData = async () => {
    await runHistoryQuery.refetch();
    await runSummaryQuery.refetch();
    await leaderboardQuery.refetch();
  };

  const uploadDatasetMutation = useMutation({
    mutationFn: async (file: File) => {
      const data = new FormData();
      data.append("file", file);
      return (await api.post<DatasetResponse>("/datasets", data)).data;
    },
    onSuccess: (response) => {
      setDataset(response);
      setModel(null);
      setTargetColumn(response.columns[0] ?? "target");
      void datasetsCatalogQuery.refetch();
      setErrorMessage(null);
    },
    onError: () => setErrorMessage("Dataset upload failed."),
  });

  const trainModelMutation = useMutation({
    mutationFn: async () => {
      if (!dataset) throw new Error("Upload a dataset first");
      return (await api.post<ModelResponse>("/models/train", { dataset_id: dataset.dataset_id, target_column: targetColumn, model_type: modelType })).data;
    },
    onSuccess: (response) => {
      setModel(response);
      void modelsCatalogQuery.refetch();
      setErrorMessage(null);
    },
    onError: () => setErrorMessage("Model training failed. Check your data and target column."),
  });

  const runMutation = useMutation({
    mutationFn: async () => {
      if (!dataset || !model) throw new Error("Upload dataset and train model first");
      return (await api.post<RunResponse>("/runs", { dataset_id: dataset.dataset_id, model_id: model.model_id, explainer: selectedExplainer, metric: selectedMetric })).data;
    },
    onSuccess: async () => {
      await refreshRunData();
      setErrorMessage(null);
    },
    onError: () => setErrorMessage("Run failed. Confirm model + dataset are ready."),
  });

  const clearHistoryMutation = useMutation({
    mutationFn: async () => { await api.delete("/runs"); },
    onSuccess: async () => { await refreshRunData(); setErrorMessage("Run history cleared."); },
    onError: () => setErrorMessage("Failed to clear run history."),
  });

  const batchRunMutation = useMutation({
    mutationFn: async () => {
      if (!dataset || !model || !explainersQuery.data) throw new Error("missing state");
      const reqs = explainersQuery.data.explainers.flatMap((explainer) => explainersQuery.data!.metrics.map((metric) => api.post<RunResponse>("/runs", { dataset_id: dataset.dataset_id, model_id: model.model_id, explainer, metric })));
      await Promise.all(reqs);
      return reqs.length;
    },
    onSuccess: async (count) => {
      await refreshRunData();
      setStep("results");
      setErrorMessage(`Completed ${count} comparison runs.`);
    },
    onError: () => setErrorMessage("Batch run failed."),
  });

  const registerImageManifestMutation = useMutation({
    mutationFn: async () =>
      (
        await api.post<ImageManifestResponse>("/datasets/image-manifest", {
          name: imageManifestName,
          image_count: imageCount,
          class_labels: imageClasses.split(",").map((x) => x.trim()).filter(Boolean),
          image_root_uri: imageRootUri,
        })
      ).data,
    onSuccess: (response) => {
      setManifest(response);
      setErrorMessage("Image manifest registered.");
    },
    onError: () => setErrorMessage("Image manifest registration failed."),
  });

  const uploadExternalModelMutation = useMutation({
    mutationFn: async () => {
      if (!dataset) throw new Error("Upload a tabular dataset first to bind target column metadata");
      return (
        await api.post<UploadedModelResponse>("/models/upload", {
          dataset_id: dataset.dataset_id,
          target_column: targetColumn,
          model_type: "pytorch_classifier",
          framework: "pytorch",
          artifact_uri: artifactUri,
          input_shape: [3, 224, 224],
          class_labels: imageClasses.split(",").map((x) => x.trim()).filter(Boolean),
        })
      ).data;
    },
    onSuccess: async (response) => {
      setUploadedModel(response);
      await modelsCatalogQuery.refetch();
      setErrorMessage("External model registered.");
    },
    onError: () => setErrorMessage("External model registration failed."),
  });

  const saliencyPreviewMutation = useMutation({
    mutationFn: async () => {
      if (!uploadedModel || !manifest) throw new Error("Register model and image manifest first");
      return (
        await api.post<SaliencyPreviewResponse>("/phase2/saliency-preview", {
          model_id: uploadedModel.model_id,
          manifest_id: manifest.manifest_id,
          sample_ref: sampleRef,
          method: "saliency",
        })
      ).data;
    },
    onSuccess: (response) => {
      setSaliencyPreview(response);
      setErrorMessage("Phase 2 saliency preview contract generated.");
    },
    onError: () => setErrorMessage("Saliency preview generation failed."),
  });

  const createBatchRunMutation = useMutation({
    mutationFn: async () => {
      if (!uploadedModel || !manifest) throw new Error("Register model and image manifest first");
      return (
        await api.post<Phase2BatchCreateResponse>("/phase2/batch-runs", {
          model_id: uploadedModel.model_id,
          manifest_id: manifest.manifest_id,
          explainers: batchExplainers.split(",").map((x) => x.trim()).filter(Boolean),
          metrics: batchMetrics.split(",").map((x) => x.trim()).filter(Boolean),
        })
      ).data;
    },
    onSuccess: async (response) => {
      const job = (await api.get<Phase2BatchJob>(`/phase2/batch-runs/${response.job_id}`)).data;
      setBatchJob(job);
      setErrorMessage("Phase 2 batch job completed (stub).\n");
    },
    onError: () => setErrorMessage("Phase 2 batch run failed."),
  });

  useEffect(() => {
    if (explainersQuery.data?.explainers.length) setSelectedExplainer(explainersQuery.data.explainers[0]);
    if (explainersQuery.data?.metrics.length) setSelectedMetric(explainersQuery.data.metrics[0]);
  }, [explainersQuery.data]);

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => setSelectedFile(event.target.files?.[0] ?? null);
  const uploadSelectedFile = () => selectedFile ? uploadDatasetMutation.mutate(selectedFile) : setErrorMessage("Select a CSV file first.");
  const uploadSampleFile = () => uploadDatasetMutation.mutate(new File([SAMPLE_CSV], "sample.csv", { type: "text/csv" }));

  const exportRunReport = async () => {
    const report = (await api.get<RunReport>("/runs/report")).data;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "run-report.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const explainerMeta = explainersQuery.data?.explainer_details.find((x) => x.key === selectedExplainer);
  const metricMeta = explainersQuery.data?.metric_details.find((x) => x.key === selectedMetric);

  const comparisonRows = useMemo(() => leaderboardQuery.data ?? [], [leaderboardQuery.data]);

  return (
    <main style={{ fontFamily: "Inter, sans-serif", padding: 24, minHeight: "100vh", background: colors.background, color: colors.text }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ marginBottom: 6 }}>Explainiverse Studio</h1>
            <p style={{ marginTop: 0, color: colors.muted }}>Phase 1 MVP workflow</p>
          </div>
          <button onClick={toggleTheme}>{isDark ? "Light" : "Dark"}</button>
        </header>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {steps.map((s) => <button key={s} onClick={() => setStep(s)}>{s}</button>)}
        </div>

        <section style={{ border: `1px solid ${colors.border}`, borderRadius: 10, padding: 16, background: colors.panel }}>
          <p>API: <code>{API_BASE_URL}</code> • Health: {healthQuery.data?.status ?? "..."}</p>
          <p>Total runs: {runSummaryQuery.data?.total_runs ?? 0} • Best: {runSummaryQuery.data?.best_run?.score?.toFixed(2) ?? "—"}</p>

          <div style={{ marginTop: 10 }}>
            <input type="file" accept=".csv,text/csv" onChange={onFileChange} />
            <button onClick={uploadSelectedFile} disabled={uploadDatasetMutation.isPending}>{uploadDatasetMutation.isPending ? "Uploading..." : "Upload CSV"}</button>
            <button onClick={uploadSampleFile}>Upload sample dataset</button>
          </div>

          {dataset ? (
            <>
              <p>Dataset: {dataset.dataset_id} ({dataset.rows} rows)</p>
              <label>Target: <select value={targetColumn} onChange={(e) => setTargetColumn(e.target.value)}>{dataset.columns.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
              <label style={{ marginLeft: 10 }}>Model: <select value={modelType} onChange={(e) => setModelType(e.target.value)}><option value="random_forest">random_forest</option><option value="logistic_regression">logistic_regression</option><option value="linear_regression">linear_regression</option></select></label>
              <button onClick={() => trainModelMutation.mutate()} disabled={trainModelMutation.isPending}>{trainModelMutation.isPending ? "Training..." : "Train model"}</button>
            </>
          ) : <p>Dataset not uploaded.</p>}

          <p>Model: {model ? `${model.model_id} (${model.model_type}, ${model.task_type}, ${model.feature_count} features)` : "not trained"}</p>

          {explainersQuery.data ? (
            <>
              <label>Explainer: <select value={selectedExplainer} onChange={(e) => setSelectedExplainer(e.target.value)}>{explainersQuery.data.explainers.map((x) => <option key={x}>{x}</option>)}</select></label>
              <label style={{ marginLeft: 10 }}>Metric: <select value={selectedMetric} onChange={(e) => setSelectedMetric(e.target.value)}>{explainersQuery.data.metrics.map((x) => <option key={x}>{x}</option>)}</select></label>
              <button onClick={() => runMutation.mutate()} disabled={runMutation.isPending}>{runMutation.isPending ? "Running..." : "Run"}</button>
              <button onClick={() => batchRunMutation.mutate()} disabled={batchRunMutation.isPending}>{batchRunMutation.isPending ? "Running all..." : "Run all combos"}</button>
              {explainerMeta ? <p style={{ color: colors.muted }}>Explainer: <b>{explainerMeta.label}</b> — {explainerMeta.description}</p> : null}
              {metricMeta ? <p style={{ color: colors.muted }}>Metric: <b>{metricMeta.label}</b> — {metricMeta.description}</p> : null}
            </>
          ) : null}

          {errorMessage ? <p style={{ color: errorMessage.startsWith("Completed") ? "#8fffb2" : "#ff8a8a" }}>{errorMessage}</p> : null}
        </section>

        <section style={{ marginTop: 12, border: `1px solid ${colors.border}`, borderRadius: 10, padding: 16, background: colors.panel }}>
          <h3>Leaderboard</h3>
          {!comparisonRows.length ? <p>No runs yet.</p> : (
            <ul>
              {comparisonRows.map((row) => <li key={`${row.explainer}-${row.metric}`}>{row.explainer} • {row.metric} — avg {row.avg_score.toFixed(3)} (n={row.count})</li>)}
            </ul>
          )}
          <button onClick={() => clearHistoryMutation.mutate()} disabled={clearHistoryMutation.isPending}>Clear history</button>
          <button onClick={() => void exportRunReport()} disabled={!runHistoryQuery.data?.length}>Export run report JSON</button>

          <h3>Saved assets</h3>
          <p>datasets: {datasetsCatalogQuery.data?.length ?? 0} • models: {modelsCatalogQuery.data?.length ?? 0}</p>
          <p>Current step: {step}</p>
        </section>

        <section style={{ marginTop: 12, border: `1px solid ${colors.border}`, borderRadius: 10, padding: 16, background: colors.panel }}>
          <h3>Phase 2 thin-slice (PyTorch + image prep)</h3>
          <div style={{ display: "grid", gap: 8 }}>
            <label>Manifest name: <input value={imageManifestName} onChange={(e) => setImageManifestName(e.target.value)} /></label>
            <label>Image count: <input type="number" value={imageCount} onChange={(e) => setImageCount(Number(e.target.value))} /></label>
            <label>Class labels (csv): <input value={imageClasses} onChange={(e) => setImageClasses(e.target.value)} /></label>
            <label>Image root URI: <input value={imageRootUri} onChange={(e) => setImageRootUri(e.target.value)} /></label>
            <button onClick={() => registerImageManifestMutation.mutate()} disabled={registerImageManifestMutation.isPending}>
              {registerImageManifestMutation.isPending ? "Registering..." : "Register image manifest"}
            </button>

            <label>External model artifact URI: <input value={artifactUri} onChange={(e) => setArtifactUri(e.target.value)} /></label>
            <button onClick={() => uploadExternalModelMutation.mutate()} disabled={uploadExternalModelMutation.isPending}>
              {uploadExternalModelMutation.isPending ? "Registering..." : "Register PyTorch model"}
            </button>

            <label>Sample ref: <input value={sampleRef} onChange={(e) => setSampleRef(e.target.value)} /></label>
            <button onClick={() => saliencyPreviewMutation.mutate()} disabled={saliencyPreviewMutation.isPending || !manifest || !uploadedModel}>
              {saliencyPreviewMutation.isPending ? "Generating..." : "Generate saliency preview (stub)"}
            </button>

            <label>Batch explainers (csv): <input value={batchExplainers} onChange={(e) => setBatchExplainers(e.target.value)} /></label>
            <label>Batch metrics (csv): <input value={batchMetrics} onChange={(e) => setBatchMetrics(e.target.value)} /></label>
            <button onClick={() => createBatchRunMutation.mutate()} disabled={createBatchRunMutation.isPending || !manifest || !uploadedModel}>
              {createBatchRunMutation.isPending ? "Submitting..." : "Run phase2 batch job (stub)"}
            </button>
          </div>

          {manifest ? <p style={{ color: colors.muted }}>Manifest: {manifest.manifest_id} ({manifest.image_count} images)</p> : null}
          {uploadedModel ? <p style={{ color: colors.muted }}>Model: {uploadedModel.model_id} ({uploadedModel.framework})</p> : null}
          {saliencyPreview ? <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(saliencyPreview, null, 2)}</pre> : null}
          {batchJob ? <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(batchJob, null, 2)}</pre> : null}
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
