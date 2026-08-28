import type { CloudCodeCallOptions } from "appambit";
import { uuidv4 } from "../utils/uuid";
import { platformSuffix, type CloudCodeDemoAction } from "./CloudCodeCatalog";

// Same "X-Sample-Client" convention as the Kotlin ("kotlin") and Swift ("swift")
// samples, and the same per-action slug/method/query/body mapping as
// requestConfiguration()/RequestConfiguration in CloudCode.kt and
// requestConfiguration(for:) in CloudCodeView.swift.
const HEADERS = { "X-Sample-Client": "react-native" };

export type CloudCodeFormState = {
  taskTitle: string;
  taskId: string;
  postUuid: string;
  publishTitle: string;
  publishBody: string;
};

export type CloudCodeRequestConfig = { slug: string } & CloudCodeCallOptions;

export function requestConfiguration(
  action: CloudCodeDemoAction,
  form: CloudCodeFormState
): CloudCodeRequestConfig {
  const taskValue = parseInt(form.taskId, 10) || 0;

  switch (action) {
    case "setupDatabase":
      return { slug: `cloud-demo-setup-database-${platformSuffix}`, method: "POST", headers: HEADERS };
    case "createTask":
      return { slug: `cloud-demo-create-task-${platformSuffix}`, method: "POST", body: { title: form.taskTitle }, headers: HEADERS };
    case "listTasks":
      return { slug: `cloud-demo-list-tasks-${platformSuffix}`, method: "GET", query: { limit: "20" }, headers: HEADERS };
    case "completeTask":
      return { slug: `cloud-demo-complete-task-${platformSuffix}`, method: "PATCH", body: { task_id: taskValue }, headers: HEADERS };
    case "deleteTask":
      return { slug: `cloud-demo-delete-task-${platformSuffix}`, method: "DELETE", body: { task_id: taskValue }, headers: HEADERS };
    case "createOrder":
      return { slug: `cloud-demo-create-order-${platformSuffix}`, method: "POST", body: { idempotency_key: uuidv4(), amount: 100 }, headers: HEADERS };
    case "summary":
      return { slug: `cloud-demo-dashboard-summary-${platformSuffix}`, method: "GET", headers: HEADERS };
    case "publishPost":
      return { slug: `cloud-demo-publish-post-${platformSuffix}`, method: "POST", body: { title: form.publishTitle, body: form.publishBody }, headers: HEADERS };
    case "readPosts":
      return { slug: `cloud-demo-read-posts-${platformSuffix}`, method: "GET", query: form.postUuid.trim() ? { uuid: form.postUuid.trim() } : undefined, headers: HEADERS };
    case "push":
      return { slug: `cloud-demo-send-push-${platformSuffix}`, method: "POST", body: { title: "Cloud Code React Native demo", body: "Push from React Native sample" }, headers: HEADERS };
    case "inspector":
      return { slug: "cloud-demo-http-inspector", method: "POST", query: { source: "react-native" }, body: { message: "hello", count: 2 }, headers: HEADERS };
    case "jsonValues":
      return { slug: "cloud-demo-json-values", method: "POST", headers: HEADERS };
    case "nullContract":
      return { slug: "cloud-demo-null-contract", method: "GET", headers: HEADERS };
    case "responseShapes":
      return { slug: "cloud-demo-response-shapes", method: "POST", headers: HEADERS };
    case "controlledError":
      return { slug: "cloud-demo-error-response", method: "POST", body: { invalid: true }, headers: HEADERS };
    case "timeout":
      return { slug: "cloud-demo-timeout-10s", method: "GET", headers: HEADERS };
    case "runtimeContext":
      return { slug: "cloud-demo-runtime-context", method: "GET", headers: HEADERS };
  }
}
