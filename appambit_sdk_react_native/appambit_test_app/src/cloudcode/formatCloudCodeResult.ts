import { CloudCodeError, CloudCodeErrorCode, type CloudCodeResponse } from "appambit";

// Mirrors formatDuration()/jsonText()/formatError() in CloudCode.kt and
// formatDuration(_:)/jsonText(_:)/format(response:error:elapsed:) in CloudCodeView.swift.

function jsonText(value: unknown): string {
  if (value === null || value === undefined) return "null";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatDuration(elapsedMs: number): string {
  return `${(elapsedMs / 1000).toFixed(2)} s`;
}

export function formatCloudCodeSuccess(
  response: Pick<CloudCodeResponse, "statusCode" | "requestId" | "data">,
  elapsedMs: number
): string {
  return [
    `HTTP ${response.statusCode}`,
    `Duration: ${formatDuration(elapsedMs)}`,
    `requestId: ${response.requestId ?? "none"}`,
    `Body: ${jsonText(response.data)}`,
  ].join("\n");
}

export function formatCloudCodeError(error: unknown, elapsedMs: number): string {
  if (error instanceof CloudCodeError && error.code === CloudCodeErrorCode.Http) {
    return [
      `Duration: ${formatDuration(elapsedMs)}`,
      `requestId: ${error.requestId ?? "none"}`,
      `HTTP error body: ${jsonText(error.body ?? error.rawBody ?? "none")}`,
      `Error: ${error.message}`,
    ].join("\n");
  }
  const message = error instanceof Error ? error.message : String(error);
  return [`Duration: ${formatDuration(elapsedMs)}`, `Error: ${message}`].join("\n");
}
