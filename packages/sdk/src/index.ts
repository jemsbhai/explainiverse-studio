export type RunRequest = {
  dataset_id: string;
  model_id: string;
  explainer: string;
  metric: string;
};

export const sdkVersion = "0.1.0";
