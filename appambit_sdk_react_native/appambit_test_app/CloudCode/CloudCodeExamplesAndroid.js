/*
 * AppAmbit Cloud Code examples catalog for Android.
 *
 * This is the exact source currently deployed and active in AppAmbit for the
 * "App Android - Java/Kotlin" app (app_key 294f7dd6-987e-493b-b13c-dfdfd0cdcd3e),
 * pulled with get-cloud-function-source-tool. It mirrors the same catalog used
 * by appambit-sdk-android/samples/CloudCodeExamples.js and
 * appambit-sdk-dotnet/samples/CloudCode/CloudCodeExamplesAndroid.js — same
 * slugs, same logic — so all sample apps read as one catalog.
 *
 * Each function below is a deployable handler body. To deploy one example,
 * copy its function body to index.js and export it as `handler`:
 *
 * export const handler = async (ctx) => { ... };
 *
 * The catalog is intentionally not deployed as one function because Cloud
 * Code deploys one handler per function and each handler has its own slug.
 */

// cloud-demo-setup-database-android | POST | Requires an existing linked Database.
export const cloudDemoSetupDatabaseAndroid = async (ctx) => {
  const { results } = await ctx.appambit.batch([
    { sql: `CREATE TABLE IF NOT EXISTS cloud_demo_tasks_android (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, title TEXT NOT NULL, completed INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)` },
    { sql: `CREATE TABLE IF NOT EXISTS cloud_demo_orders_android (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, idempotency_key TEXT NOT NULL, amount INTEGER NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE (user_id, idempotency_key))` },
  ], true);
  return { ok: true, platform: 'android', tables: ['cloud_demo_tasks_android', 'cloud_demo_orders_android'], statements: results.length };
};

// cloud-demo-create-task-android | POST | Requires cloud_demo_tasks_android.
export const cloudDemoCreateTaskAndroid = async (ctx) => {
  const userId = ctx.consumer?.id;
  const title = String(ctx.req?.body?.title ?? '').trim();
  if (!userId || !title) return { status: 400, body: { error: 'title_required' } };
  const { results } = await ctx.appambit.db('INSERT INTO cloud_demo_tasks_android (user_id, title, created_at) VALUES (?, ?, ?) RETURNING *', [userId, title, new Date().toISOString()]);
  const result = results[0];
  const row = result.rows[0];
  const task = Object.fromEntries(result.columns.map((column, index) => [column, row[index]]));
  return { status: 201, body: { task, platform: 'android' } };
};

// cloud-demo-list-tasks-android | GET | Requires cloud_demo_tasks_android.
export const cloudDemoListTasksAndroid = async (ctx) => {
  const userId = ctx.consumer?.id;
  if (!userId) return { status: 401, body: { error: 'consumer_required' } };
  const requestedLimit = Number(ctx.req?.query?.limit ?? 20);
  const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 20, 1), 50);
  const { results } = await ctx.appambit.db('SELECT id, title, completed, created_at FROM cloud_demo_tasks_android WHERE user_id = ? ORDER BY created_at DESC LIMIT ?', [userId, limit]);
  const result = results[0];
  const tasks = result.rows.map((row) => Object.fromEntries(result.columns.map((column, index) => [column, row[index]])));
  return { tasks, platform: 'android' };
};

// cloud-demo-complete-task-android | PATCH | Requires cloud_demo_tasks_android and task_id.
//
// Fixed 2026-08-25 (QA testing session): the previously deployed version
// checked results[1] (the audit INSERT, which always writes a row) instead
// of results[0] (the real UPDATE), so the 404 branch was unreachable and a
// nonexistent/foreign task_id silently reported ok:true while leaving an
// orphan audit row. This version guards the audit INSERT with WHERE EXISTS
// so it only runs when the UPDATE actually matched a row owned by userId,
// and checks SELECT changes() for the real affected-row count — matching
// propuesta section 5: "No se debe considerar exitoso el resultado de una
// sentencia secundaria si la task no existía." Verified via direct SQL
// against the live schema before deploying.
export const cloudDemoCompleteTaskAndroid = async (ctx) => {
  const userId = ctx.consumer?.id;
  const taskId = Number(ctx.req?.body?.task_id);
  if (!userId || !Number.isInteger(taskId) || taskId < 1) return { status: 400, body: { error: 'task_id_required' } };

  const { results } = await ctx.appambit.batch([
    { sql: 'UPDATE cloud_demo_tasks_android SET completed = 1 WHERE id = ? AND user_id = ?', params: [taskId, userId] },
    { sql: 'SELECT changes() AS rows_updated' },
    {
      sql: `INSERT INTO cloud_demo_tasks_android (user_id, title, created_at)
        SELECT ?, ?, ?
        WHERE EXISTS (
          SELECT 1 FROM cloud_demo_tasks_android WHERE id = ? AND user_id = ?
        )`,
      params: [userId, 'Transaction audit Android', new Date().toISOString(), taskId, userId],
    },
  ], true);

  const updateResult = results.find((result) => result.columns?.includes('rows_updated'));
  const rowsUpdated = Number(updateResult?.rows?.[0]?.[0] ?? 0);
  if (rowsUpdated === 0) return { status: 404, body: { error: 'task_not_found' } };
  return { ok: true, platform: 'android', transaction: true, statements: results.length };
};

// cloud-demo-delete-task-android | DELETE | Requires cloud_demo_tasks_android, task_id and confirmation.
export const cloudDemoDeleteTaskAndroid = async (ctx) => {
  const userId = ctx.consumer?.id;
  const taskId = Number(ctx.req?.body?.task_id);
  if (!userId || !Number.isInteger(taskId) || taskId < 1) return { status: 400, body: { error: 'task_id_required' } };
  const result = await ctx.appambit.db('DELETE FROM cloud_demo_tasks_android WHERE id = ? AND user_id = ?', [taskId, userId]);
  if ((result.results[0]?.rows_written ?? 0) === 0) return { status: 404, body: { error: 'task_not_found' } };
  return { status: 204, body: null };
};

// cloud-demo-create-order-android | POST | Requires cloud_demo_orders_android.
export const cloudDemoCreateOrderAndroid = async (ctx) => {
  const userId = ctx.consumer?.id;
  const key = String(ctx.req?.body?.idempotency_key ?? '').trim();
  const amount = Number(ctx.req?.body?.amount);
  if (!userId || !key || !Number.isInteger(amount) || amount < 1) return { status: 400, body: { error: 'order_input_required' } };
  const existing = await ctx.appambit.db('SELECT id, user_id, idempotency_key, amount, status, created_at FROM cloud_demo_orders_android WHERE user_id = ? AND idempotency_key = ?', [userId, key]);
  if (existing.results[0].rows.length > 0) return { idempotent: true, platform: 'android', order: existing.results[0].rows[0] };
  try {
    const { results } = await ctx.appambit.db('INSERT INTO cloud_demo_orders_android (user_id, idempotency_key, amount, status, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id, user_id, idempotency_key, amount, status, created_at', [userId, key, amount, 'created', new Date().toISOString()]);
    return { idempotent: false, platform: 'android', order: results[0].rows[0] };
  } catch (error) {
    return { status: 409, body: { error: 'idempotency_conflict', message: error.message } };
  }
};

// cloud-demo-dashboard-summary-android | GET | Requires Database and CMS setup.
export const cloudDemoDashboardSummaryAndroid = async (ctx) => {
  const userId = ctx.consumer?.id;
  if (!userId) return { status: 401, body: { error: 'consumer_required' } };

  const requiredTables = ['cloud_demo_tasks_android', 'cloud_demo_orders_android'];
  let databaseAvailable = false;
  let databaseTablesReady = false;
  let taskCount = null;

  try {
    const { results: tableResults } = await ctx.appambit.db(
      'SELECT name FROM sqlite_master WHERE type = ? AND name IN (?, ?)',
      ['table', ...requiredTables],
    );
    const tableNames = new Set(tableResults[0].rows.map(row => row[0]));
    databaseAvailable = true;
    databaseTablesReady = requiredTables.every(table => tableNames.has(table));

    if (databaseTablesReady) {
      const { results: taskResults } = await ctx.appambit.db(
        'SELECT COUNT(*) AS task_count FROM cloud_demo_tasks_android WHERE user_id = ?',
        [userId],
      );
      taskCount = taskResults[0].rows[0][0];
    }
  } catch (_) {
    databaseAvailable = false;
    databaseTablesReady = false;
  }

  const posts = await ctx.appambit.cms.list('cloud_code_demo_posts_android', {
    status: 'published',
    per_page: 5,
  });

  return {
    database_available: databaseAvailable,
    database_tables_ready: databaseTablesReady,
    task_count: taskCount,
    posts: posts.data ?? [],
    platform: 'android',
  };
};

// cloud-demo-read-posts-android | GET | Requires cloud_code_demo_posts_android.
export const cloudDemoReadPostsAndroid = async (ctx) => {
  const uuid = ctx.req?.query?.uuid;
  if (uuid) return await ctx.appambit.cms.get('cloud_code_demo_posts_android', uuid);
  return await ctx.appambit.cms.list('cloud_code_demo_posts_android', { status: 'published', per_page: 5 });
};

// cloud-demo-publish-post-android | POST | Requires cloud_code_demo_posts_android.
export const cloudDemoPublishPostAndroid = async (ctx) => {
  const title = String(ctx.req?.body?.title ?? '').trim();
  const body = String(ctx.req?.body?.body ?? '').trim();
  if (!title || !body) return { status: 400, body: { error: 'title_and_body_required' } };
  const post = await ctx.appambit.cms.publish('cloud_code_demo_posts_android', { title, body });
  return { status: 201, body: { post, platform: 'android' } };
};

// cloud-demo-send-push-android | POST | Requires configured FCM credentials.
export const cloudDemoSendPushAndroid = async (ctx) => {
  const input = ctx.req?.body ?? {};
  await ctx.appambit.push({
    title: String(input.title ?? 'Cloud Code Android demo'),
    body: String(input.body ?? 'Push from the Android Cloud Code function.'),
  });
  return { notified: true, platform: 'android' };
};

// cloud-demo-task-event-android | Event trigger (db / cloud_demo_tasks_android / insert,update,delete) | Not invoked from mobile.
export const cloudDemoTaskEventAndroid = async (ctx) => {
  const change = ctx.event ?? {};
  ctx.log('cloud_demo_tasks_android changed', { operation: change.operation, table: change.table });
  return { handled: true, platform: 'android', operation: change.operation ?? null };
};

// cloud-demo-http-inspector | POST | Shared HTTP catalog, no platform suffix.
export const cloudDemoHttpInspector = async (ctx) => ({
  context: {
    method: ctx.req?.method ?? null,
    slug: ctx.req?.slug ?? null,
    query: ctx.req?.query ?? {},
    headers: ctx.req?.headers ?? {},
    body: ctx.req?.body ?? {},
    consumer_id: ctx.consumer?.id ?? null,
  },
});

// cloud-demo-json-values | POST | Shared HTTP catalog, no platform suffix.
export const cloudDemoJsonValues = async () => ({
  object: { ok: true },
  array: [1, 'two', true],
  string: 'hello',
  number: 7,
  boolean: true,
});

// cloud-demo-null-contract | GET | Shared HTTP catalog, no platform suffix.
export const cloudDemoNullContract = async () => ({
  raw: null,
  explicit: { value: null },
});

// cloud-demo-response-shapes | POST | Shared HTTP catalog, no platform suffix.
export const cloudDemoResponseShapes = async (ctx) => {
  if (ctx.req?.query?.empty === 'true') return { status: 204, body: null };
  return { status: 201, headers: { 'X-Custom': 'yes' }, body: { created: true, status_example: 201 } };
};

// cloud-demo-error-response | POST | Shared HTTP catalog, no platform suffix.
export const cloudDemoErrorResponse = async (ctx) => {
  if (!ctx.req?.body?.valid) return { status: 400, body: { error: 'validation_failed', message: 'Set valid=true to pass validation.' } };
  return { ok: true };
};

// cloud-demo-timeout-10s | GET | Shared HTTP catalog, requires a 10s function timeout.
export const cloudDemoTimeoutAndroid = async () => {
  await new Promise((resolve) => setTimeout(resolve, 12000));
  return { completed_after_seconds: 12, platform: 'android' };
};

// cloud-demo-runtime-context | GET | Shared HTTP catalog, requires DEMO_REGION + DEMO_SECRET.
export const cloudDemoRuntimeContext = async (ctx) => {
  const region = ctx.env?.DEMO_REGION ?? null;
  const hasSecret = Boolean(ctx.secrets?.DEMO_SECRET);
  ctx.log('Cloud Code context demo', { has_region: Boolean(region), has_secret: hasSecret });
  return { region, has_secret: hasSecret };
};

// cloud-demo-manual-report | Manual trigger | Runs from the Dashboard, not invoked from mobile.
export const cloudDemoManualReport = async (ctx) => {
  const input = ctx.req ?? {};
  ctx.log('manual demo run', input);
  return { ran: true, input };
};
