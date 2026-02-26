export type RunRequest = {
  dataset_id: string;
  model_id: string;
  explainer: string;
  metric: string;
};

export type ValidateArtifactResponse = {
  model_id: string;
  framework: string;
  artifact_uri: string;
  checks: {
    uri_scheme_valid: boolean;
    extension_expected: string[];
    extension_ok: boolean;
    uri_accessibility: "reachable" | "unreachable" | "not_checked";
    uri_accessibility_reason: string;
  };
  status: string;
  phase: string;
};

export type Phase2BatchCreateRequest = {
  model_id: string;
  manifest_id: string;
  explainers: string[];
  metrics: string[];
};

export type Phase2BatchCreateResponse = {
  job_id: string;
  status: string;
  phase: string;
  poll_url: string;
  progress: { completed: number; total: number };
};

export type Phase2BatchJob = {
  job_id: string;
  model_id: string;
  manifest_id: string;
  status: string;
  progress: { completed: number; total: number };
  created_at: string;
  updated_at: string;
  results: { explainer: string; metric: string; score: number; status: string }[];
};

export class ExplainiverseStudioClient {
  constructor(private readonly baseUrl: string) {}

  async createPhase2BatchRun(payload: Phase2BatchCreateRequest): Promise<Phase2BatchCreateResponse> {
    const response = await fetch(`${this.baseUrl}/phase2/batch-runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`Failed to create phase2 batch run: ${response.status}`);
    return response.json();
  }

  async getPhase2BatchRun(jobId: string): Promise<Phase2BatchJob> {
    const response = await fetch(`${this.baseUrl}/phase2/batch-runs/${jobId}`);
    if (!response.ok) throw new Error(`Failed to fetch phase2 batch run: ${response.status}`);
    return response.json();
  }

  async listPhase2BatchRuns(): Promise<{ jobs: Phase2BatchJob[] }> {
    const response = await fetch(`${this.baseUrl}/phase2/batch-runs`);
    if (!response.ok) throw new Error(`Failed to list phase2 batch runs: ${response.status}`);
    return response.json();
  }

  async cancelPhase2BatchRun(jobId: string): Promise<{ job_id: string; status: string }> {
    const response = await fetch(`${this.baseUrl}/phase2/batch-runs/${jobId}/cancel`, {
      method: "POST",
    });
    if (!response.ok) throw new Error(`Failed to cancel phase2 batch run: ${response.status}`);
    return response.json();
  }

  async validateModelArtifact(modelId: string): Promise<ValidateArtifactResponse> {
    const response = await fetch(`${this.baseUrl}/models/validate-artifact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model_id: modelId }),
    });
    if (!response.ok) throw new Error(`Failed to validate model artifact: ${response.status}`);
    return response.json();
  }
}

export const sdkVersion = "0.2.0";
