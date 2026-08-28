import { useEffect, useState } from "react";
import * as PushNotifications from "appambit-push-notifications";
import { CloudCode } from "appambit";
import {
  CONFIRM_ACTIONS,
  type CloudCodeDemo,
  setupDatabaseDemo,
} from "./CloudCodeCatalog";
import { requestConfiguration, type CloudCodeFormState } from "./requestConfiguration";
import { formatCloudCodeError, formatCloudCodeSuccess } from "./formatCloudCodeResult";

// Mirrors the state + verifyBackend()/callDemo()/requestConfiguration() wiring in
// CloudCode.kt (Android sample) and the @State + verifyBackend()/run()/call() wiring
// in CloudCodeView.swift (iOS sample): a Database "setup" card verified on mount via
// the typed dashboard-summary call, per-demo results shown under the demo that ran,
// and a single confirmation gate for delete/publish/push.

type CloudCodeSummary = {
  task_count: number | null;
  database_available: boolean;
  database_tables_ready: boolean;
  posts: unknown[] | null;
  platform: string;
};

function summaryFromJson(value: unknown): CloudCodeSummary {
  const v = (value ?? {}) as Record<string, unknown>;
  return {
    task_count: typeof v.task_count === "number" ? v.task_count : null,
    database_available: v.database_available === true,
    database_tables_ready: v.database_tables_ready === true,
    posts: Array.isArray(v.posts) ? v.posts : null,
    platform: typeof v.platform === "string" ? v.platform : "",
  };
}

async function ensurePushReady(): Promise<boolean> {
  const hasPermission = await PushNotifications.hasNotificationPermission();
  if (hasPermission) {
    PushNotifications.setNotificationsEnabled(true);
    return true;
  }
  const granted = await PushNotifications.requestNotificationPermissionWithResult();
  if (granted) PushNotifications.setNotificationsEnabled(true);
  return granted;
}

export function useCloudCodeRunner() {
  const [taskTitle, setTaskTitle] = useState("Buy coffee");
  const [taskId, setTaskId] = useState("");
  const [postUuid, setPostUuid] = useState("");
  const [publishTitle, setPublishTitle] = useState("Cloud Code sample post");
  const [publishBody, setPublishBody] = useState("Published through an HTTP Cloud Function.");

  const [isVerifyingBackend, setIsVerifyingBackend] = useState(false);
  const [databaseAvailable, setDatabaseAvailable] = useState(false);
  const [databaseTablesReady, setDatabaseTablesReady] = useState(false);
  const [databaseStatus, setDatabaseStatus] = useState("Not available");
  const [cmsAvailable, setCmsAvailable] = useState(false);
  const [cmsStatus, setCmsStatus] = useState("Not available");

  const [isRunning, setIsRunning] = useState(false);
  const [lastResultDemoId, setLastResultDemoId] = useState<string | null>(null);
  const [resultTitle, setResultTitle] = useState("Latest result");
  const [resultText, setResultText] = useState("No Cloud Code request yet.");
  const [isResultExpanded, setIsResultExpanded] = useState(true);
  const [pendingConfirmation, setPendingConfirmation] = useState<CloudCodeDemo | null>(null);

  const form: CloudCodeFormState = { taskTitle, taskId, postUuid, publishTitle, publishBody };

  const showResult = (id: string, title: string, text: string) => {
    setLastResultDemoId(id);
    setResultTitle(title);
    setResultText(text);
    setIsResultExpanded(true);
  };

  const verifyBackend = async () => {
    if (isVerifyingBackend) return;
    setIsVerifyingBackend(true);
    setDatabaseStatus("Checking...");
    setCmsStatus("Checking...");
    try {
      const config = requestConfiguration("summary", form);
      const result = await CloudCode.callTyped(config.slug, { ...config, fromJson: summaryFromJson });
      const available = result.data?.database_available === true;
      const tablesReady = result.data?.database_tables_ready === true;
      setDatabaseAvailable(available);
      setDatabaseTablesReady(tablesReady);
      setDatabaseStatus(!available ? "Not available" : tablesReady ? "Tables ready" : "Available");
      const hasPosts = result.data?.posts != null;
      setCmsAvailable(hasPosts);
      setCmsStatus(hasPosts ? "Available" : "Not available");
    } catch {
      setDatabaseAvailable(false);
      setDatabaseTablesReady(false);
      setCmsAvailable(false);
      setDatabaseStatus("Not available");
      setCmsStatus("Not available");
    } finally {
      setIsVerifyingBackend(false);
    }
  };

  useEffect(() => {
    verifyBackend();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const call = async (demo: CloudCodeDemo) => {
    const config = requestConfiguration(demo.action, form);
    setIsRunning(true);
    setLastResultDemoId(demo.id);
    setResultTitle(`Latest result · ${config.slug}`);
    setResultText(`Calling ${config.slug}...`);
    setIsResultExpanded(true);
    const started = Date.now();

    try {
      if (demo.action === "summary") {
        const result = await CloudCode.callTyped(config.slug, { ...config, fromJson: summaryFromJson });
        setResultText(
          formatCloudCodeSuccess(
            { statusCode: result.statusCode, requestId: result.requestId, data: result.data },
            Date.now() - started
          )
        );
      } else {
        const response = await CloudCode.call(config.slug, config);
        setResultText(formatCloudCodeSuccess(response, Date.now() - started));
      }
    } catch (error) {
      setResultText(formatCloudCodeError(error, Date.now() - started));
    } finally {
      setIsRunning(false);
    }
  };

  const run = (demo: CloudCodeDemo) => {
    if (isRunning) return;
    if (demo.action === "setupDatabase" && (!databaseAvailable || databaseTablesReady)) return;

    if ((demo.action === "completeTask" || demo.action === "deleteTask") && !Number.isFinite(parseInt(taskId, 10))) {
      showResult(demo.id, "Input required", "Enter a numeric task id first.");
      return;
    }

    if (demo.action === "push") {
      ensurePushReady().then((granted) => {
        if (granted) call(demo);
        else showResult(demo.id, "Permission required", "Notification permission is required. Enable notifications and try again.");
      });
      return;
    }

    call(demo);
  };

  const runOrConfirm = (demo: CloudCodeDemo) => {
    if (CONFIRM_ACTIONS.includes(demo.action)) {
      setPendingConfirmation(demo);
    } else {
      run(demo);
    }
  };

  const confirmPending = () => {
    const demo = pendingConfirmation;
    setPendingConfirmation(null);
    if (demo) run(demo);
  };

  const cancelPending = () => setPendingConfirmation(null);

  const canRunSetupDatabase = databaseAvailable && !databaseTablesReady && !isVerifyingBackend && !isRunning;

  return {
    form: { taskTitle, taskId, postUuid, publishTitle, publishBody },
    setTaskTitle,
    setTaskId,
    setPostUuid,
    setPublishTitle,
    setPublishBody,

    isVerifyingBackend,
    databaseStatus,
    databaseAvailable,
    databaseTablesReady,
    cmsStatus,
    cmsAvailable,
    canRunSetupDatabase,
    setupDatabaseDemo,

    isRunning,
    lastResultDemoId,
    resultTitle,
    resultText,
    isResultExpanded,
    setIsResultExpanded,

    pendingConfirmation,
    runOrConfirm,
    confirmPending,
    cancelPending,
  };
}
