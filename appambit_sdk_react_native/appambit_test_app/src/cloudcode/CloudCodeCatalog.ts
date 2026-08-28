import { Platform } from "react-native";

// Mirrors appambit-sdk-android's samples/kotlin-app/.../CloudCodeCatalog.kt and
// appambit-sdk-ios's Samples/AppAmbit.App.Swift/models/CloudCodeDemo.swift — same
// ids, sections, titles, details and prerequisites, so the three sample apps read
// as the same catalog. Only the slug suffix (-android / -ios / here) and casing
// idioms differ per platform.

export type CloudCodeSection = "Database" | "CMS" | "Push" | "HTTP";

export type CloudCodeDemoAction =
  | "setupDatabase"
  | "createTask"
  | "listTasks"
  | "completeTask"
  | "deleteTask"
  | "createOrder"
  | "summary"
  | "publishPost"
  | "readPosts"
  | "push"
  | "inspector"
  | "jsonValues"
  | "nullContract"
  | "responseShapes"
  | "controlledError"
  | "timeout"
  | "runtimeContext";

export type CloudCodeDemo = {
  id: string;
  section: CloudCodeSection;
  title: string;
  slug: string;
  detail: string;
  prerequisite: string;
  action: CloudCodeDemoAction;
};

export const platformSuffix = Platform.OS === "android" ? "android" : "ios";

export const sectionNames: CloudCodeSection[] = ["Database", "CMS", "Push", "HTTP"];

export const setupDatabaseDemo: CloudCodeDemo = {
  id: "setup-database",
  section: "Database",
  title: "Setup database",
  slug: `cloud-demo-setup-database-${platformSuffix}`,
  detail: "Create the tables used by the Database examples without destroying data.",
  prerequisite: "Existing linked Database",
  action: "setupDatabase",
};

export const cloudCodeDemos: CloudCodeDemo[] = [
  { id: "create-task", section: "Database", title: "Create task", slug: `cloud-demo-create-task-${platformSuffix}`, detail: "Insert a task for the signed-in consumer.", prerequisite: `cloud_demo_tasks_${platformSuffix}`, action: "createTask" },
  { id: "list-tasks", section: "Database", title: "List tasks", slug: `cloud-demo-list-tasks-${platformSuffix}`, detail: "Read the current consumer's tasks.", prerequisite: `cloud_demo_tasks_${platformSuffix}`, action: "listTasks" },
  { id: "complete-task", section: "Database", title: "Complete task", slug: `cloud-demo-complete-task-${platformSuffix}`, detail: "Update one task with consumer ownership.", prerequisite: "Task id", action: "completeTask" },
  { id: "delete-task", section: "Database", title: "Delete task", slug: `cloud-demo-delete-task-${platformSuffix}`, detail: "Delete one task owned by the consumer.", prerequisite: "Task id + confirmation", action: "deleteTask" },
  { id: "order", section: "Database", title: "Create idempotent order", slug: `cloud-demo-create-order-${platformSuffix}`, detail: "Create an order without duplicate idempotency keys.", prerequisite: `cloud_demo_orders_${platformSuffix}`, action: "createOrder" },
  { id: "summary", section: "Database", title: "Dashboard summary", slug: `cloud-demo-dashboard-summary-${platformSuffix}`, detail: "Combine Database and CMS in one typed response.", prerequisite: "Database + CMS", action: "summary" },
  { id: "create-sample-content", section: "CMS", title: "Create sample content", slug: `cloud-demo-publish-post-${platformSuffix}`, detail: "Create a published CMS entry.", prerequisite: "Confirmation", action: "publishPost" },
  { id: "read-posts", section: "CMS", title: "Read CMS posts", slug: `cloud-demo-read-posts-${platformSuffix}`, detail: "List published entries using only CMS data.", prerequisite: `cloud_code_demo_posts_${platformSuffix}`, action: "readPosts" },
  { id: "push", section: "Push", title: "Send push notification", slug: `cloud-demo-send-push-${platformSuffix}`, detail: `Send a notification to all ${platformSuffix === "android" ? "Android" : "iOS"} consumers.`, prerequisite: `Permission + ${platformSuffix === "android" ? "FCM" : "APNs"}`, action: "push" },
  { id: "inspector", section: "HTTP", title: "Inspect HTTP context", slug: "cloud-demo-http-inspector", detail: "Inspect method, query, body and consumer context.", prerequisite: "HTTP trigger", action: "inspector" },
  { id: "json-values", section: "HTTP", title: "JSON values", slug: "cloud-demo-json-values", detail: "Return common JSON value types.", prerequisite: "HTTP trigger", action: "jsonValues" },
  { id: "null-contract", section: "HTTP", title: "Null contract", slug: "cloud-demo-null-contract", detail: "Compare raw null and an explicit value.", prerequisite: "HTTP trigger", action: "nullContract" },
  { id: "response-shapes", section: "HTTP", title: "HTTP response shapes", slug: "cloud-demo-response-shapes", detail: "Demonstrate statuses, body and headers.", prerequisite: "HTTP trigger", action: "responseShapes" },
  { id: "controlled-error", section: "HTTP", title: "Controlled error", slug: "cloud-demo-error-response", detail: "Return a safe client error response.", prerequisite: "HTTP trigger", action: "controlledError" },
  { id: "timeout", section: "HTTP", title: "Backend timeout", slug: "cloud-demo-timeout-10s", detail: "Observe the configured function timeout.", prerequisite: "Function timeout = 10 s", action: "timeout" },
  { id: "runtime-context", section: "HTTP", title: "Runtime context", slug: "cloud-demo-runtime-context", detail: "Use environment values, secrets and logs safely.", prerequisite: "DEMO_REGION + DEMO_SECRET", action: "runtimeContext" },
];

// Actions that call a real backend mutation and must be confirmed (propuesta.md
// section 11 / the Kotlin & Swift samples: delete, publish, push).
export const CONFIRM_ACTIONS: CloudCodeDemoAction[] = ["deleteTask", "publishPost", "push"];
