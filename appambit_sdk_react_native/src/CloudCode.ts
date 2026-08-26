import NativeAppambitCloudCode from './NativeAppambitCloudCode';

export type CloudCodeHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export enum CloudCodeErrorCode {
  NotInitialized = 'NOT_INITIALIZED',
  InvalidFunction = 'INVALID_FUNCTION',
  InvalidMethod = 'INVALID_METHOD',
  InvalidQuery = 'INVALID_QUERY',
  InvalidBody = 'INVALID_BODY',
  InvalidHeader = 'INVALID_HEADER',
  InvalidResponseType = 'INVALID_RESPONSE_TYPE',
  Cancelled = 'CANCELLED',
  NetworkUnavailable = 'NETWORK_UNAVAILABLE',
  TimedOut = 'TIMED_OUT',
  InvalidUrl = 'INVALID_URL',
  Transport = 'TRANSPORT',
  Decoding = 'DECODING',
  Http = 'HTTP',
  Unknown = 'UNKNOWN',
}

export type CloudCodeErrorDetails = {
  function?: string;
  header?: string;
  query?: string;
  statusCode?: number;
  body?: unknown;
  rawBody?: string;
  requestId?: string | null;
};

export class CloudCodeError extends Error {
  readonly code: CloudCodeErrorCode;
  readonly function?: string;
  readonly header?: string;
  readonly query?: string;
  readonly statusCode?: number;
  readonly body?: unknown;
  readonly rawBody?: string;
  readonly requestId?: string | null;

  constructor(
    code: CloudCodeErrorCode,
    message: string,
    details?: CloudCodeErrorDetails
  ) {
    super(message);
    this.name = 'CloudCodeError';
    this.code = code;
    this.function = details?.function;
    this.header = details?.header;
    this.query = details?.query;
    this.statusCode = details?.statusCode;
    this.body = details?.body;
    this.rawBody = details?.rawBody;
    this.requestId = details?.requestId ?? null;
    Object.setPrototypeOf(this, CloudCodeError.prototype);
  }
}

export type CloudCodeResponse = {
  data: unknown;
  statusCode: number;
  requestId: string | null;
  headers: Record<string, string>;
};

export type CloudCodeResult<T> = {
  data: T | null;
  statusCode: number;
  requestId: string | null;
  headers: Record<string, string>;
};

export type CloudCodeCallOptions = {
  method?: CloudCodeHttpMethod;
  query?: Record<string, string>;
  body?: Record<string, unknown> | null;
  headers?: Record<string, string>;
  /**
   * Optional client-side deadline in milliseconds. Opt-in; omit (the default) for no
   * JS-side timeout. Both native platforms already enforce Cloud Code's mandated 60s
   * end-to-end timeout on their own, so this is not required for correctness — it's an
   * additional, cheap safety net that lets a caller give up earlier than that and cancels
   * the native request when it fires. On timeout the request settles with
   * `CloudCodeErrorCode.TimedOut`.
   */
  timeout?: number;
};

type SettleResult<T> = { ok: true; value: T } | { ok: false; error: unknown };

const MAX_SNAPSHOT_DEPTH = 32;

function snapshotJsonValue(
  value: unknown,
  depth = 0,
  seen: Set<unknown> = new Set()
): unknown {
  if (depth > MAX_SNAPSHOT_DEPTH) {
    throw new CloudCodeError(
      CloudCodeErrorCode.InvalidBody,
      'Cloud Code body exceeds the maximum nesting depth'
    );
  }
  // Only reached for a top-level value or an array element (object properties short-circuit
  // `undefined` below, before ever recursing here) — matches JSON.stringify, which turns an
  // `undefined` array element into `null` but drops an `undefined` object property entirely.
  if (value === null || value === undefined) return null;

  const type = typeof value;
  if (type === 'string' || type === 'boolean') return value;
  if (type === 'number') {
    if (!Number.isFinite(value as number)) {
      throw new CloudCodeError(
        CloudCodeErrorCode.InvalidBody,
        'Cloud Code body cannot contain NaN or Infinity'
      );
    }
    return value;
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) {
      throw new CloudCodeError(
        CloudCodeErrorCode.InvalidBody,
        'Cloud Code body contains a circular reference'
      );
    }
    seen.add(value);
    const out = value.map((item) => snapshotJsonValue(item, depth + 1, seen));
    seen.delete(value);
    return out;
  }

  if (type === 'object') {
    if (
      value instanceof Date ||
      value instanceof Map ||
      value instanceof Set ||
      value instanceof RegExp ||
      value instanceof ArrayBuffer
    ) {
      throw new CloudCodeError(
        CloudCodeErrorCode.InvalidBody,
        `Cloud Code body contains an unsupported value type: ${Object.prototype.toString.call(value)}`
      );
    }
    if (seen.has(value)) {
      throw new CloudCodeError(
        CloudCodeErrorCode.InvalidBody,
        'Cloud Code body contains a circular reference'
      );
    }
    seen.add(value);
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as object)) {
      const raw = (value as Record<string, unknown>)[key];
      // Omit the key entirely for `undefined` (JSON.stringify semantics: "field absent"),
      // instead of writing an explicit `null` (which means "field cleared" to a PATCH-style
      // handler) — see propusal.md section 8 on preserving the null-vs-absent distinction.
      if (raw === undefined) continue;
      out[key] = snapshotJsonValue(raw, depth + 1, seen);
    }
    seen.delete(value);
    return out;
  }

  throw new CloudCodeError(
    CloudCodeErrorCode.InvalidBody,
    `Cloud Code body contains an unsupported value type: ${type}`
  );
}

function snapshotStringMap(
  value: Record<string, string> | undefined,
  errorCode: CloudCodeErrorCode.InvalidQuery | CloudCodeErrorCode.InvalidHeader
): Record<string, string> {
  if (!value) return {};
  const out: Record<string, string> = {};
  for (const key of Object.keys(value)) {
    const entry = value[key];
    if (typeof entry !== 'string') {
      const details =
        errorCode === CloudCodeErrorCode.InvalidHeader
          ? { header: key }
          : { query: key };
      throw new CloudCodeError(
        errorCode,
        `Cloud Code expected a string value for "${key}"`,
        details
      );
    }
    out[key] = entry;
  }
  return out;
}

let requestCounter = 0;

function nextRequestId(): string {
  requestCounter = (requestCounter + 1) % Number.MAX_SAFE_INTEGER;
  return `rn-${Date.now()}-${requestCounter}`;
}

const NATIVE_ERROR_CODES: Record<string, CloudCodeErrorCode> = {
  NOT_INITIALIZED: CloudCodeErrorCode.NotInitialized,
  INVALID_FUNCTION: CloudCodeErrorCode.InvalidFunction,
  INVALID_METHOD: CloudCodeErrorCode.InvalidMethod,
  INVALID_QUERY: CloudCodeErrorCode.InvalidQuery,
  INVALID_BODY: CloudCodeErrorCode.InvalidBody,
  INVALID_HEADER: CloudCodeErrorCode.InvalidHeader,
  INVALID_RESPONSE_TYPE: CloudCodeErrorCode.InvalidResponseType,
  CANCELLED: CloudCodeErrorCode.Cancelled,
  NETWORK_UNAVAILABLE: CloudCodeErrorCode.NetworkUnavailable,
  TIMED_OUT: CloudCodeErrorCode.TimedOut,
  INVALID_URL: CloudCodeErrorCode.InvalidUrl,
  TRANSPORT: CloudCodeErrorCode.Transport,
  DECODING: CloudCodeErrorCode.Decoding,
  HTTP: CloudCodeErrorCode.Http,
};

// The native bridge always rejects with `promise.reject(code, message, userInfo)` (Android)
// or an NSError built with an equivalent `userInfo` dictionary (iOS) — see
// AppambitCloudCodeModule.kt / AppAmbitSdkWrapper.swift. Both platforms populate the same
// key set, so this parsing is platform-agnostic; unrecognized shapes degrade to `Unknown`
// instead of throwing, since a rejected native promise must always become a CloudCodeError.
function toCloudCodeError(err: unknown): CloudCodeError {
  if (err instanceof CloudCodeError) return err;

  const anyErr = err as any;
  const userInfo = anyErr?.userInfo ?? {};
  const rawCode: string | undefined = userInfo.code ?? anyErr?.code;
  const code =
    (rawCode && NATIVE_ERROR_CODES[rawCode]) || CloudCodeErrorCode.Unknown;
  const message: string =
    (typeof anyErr?.message === 'string' && anyErr.message) ||
    'Cloud Code request failed';

  return new CloudCodeError(code, message, {
    function:
      typeof userInfo.function === 'string' ? userInfo.function : undefined,
    header: typeof userInfo.header === 'string' ? userInfo.header : undefined,
    statusCode:
      typeof userInfo.statusCode === 'number' && userInfo.statusCode >= 0
        ? userInfo.statusCode
        : undefined,
    body: userInfo.body,
    rawBody:
      typeof userInfo.rawBody === 'string' ? userInfo.rawBody : undefined,
    requestId:
      typeof userInfo.requestId === 'string' ? userInfo.requestId : null,
  });
}

export class CloudCodeRequest<T> implements PromiseLike<T> {
  readonly requestId: string;
  private readonly _promise: Promise<T>;
  private _settle!: (result: SettleResult<T>) => void;
  private _completed = false;
  private _cancelRequested = false;
  private _timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  private constructor(requestId: string) {
    this.requestId = requestId;
    this._promise = new Promise<T>((resolve, reject) => {
      this._settle = (result) => {
        if (this._completed) return;
        this._completed = true;
        // Every completion path (success, native error, cancel, timeout) funnels through
        // here, so this is the single place that needs to release a pending timer.
        if (this._timeoutHandle !== null) {
          clearTimeout(this._timeoutHandle);
          this._timeoutHandle = null;
        }
        if (result.ok) resolve(result.value);
        else reject(result.error);
      };
    });
  }

  /** @internal */
  static _create<T>(
    requestId: string,
    run: (settle: (result: SettleResult<T>) => void) => void
  ): CloudCodeRequest<T> {
    const request = new CloudCodeRequest<T>(requestId);
    run(request._settle);
    return request;
  }

  /**
   * @internal Arms an opt-in client-side deadline. No-op if the request already settled
   * synchronously (e.g. a local validation error) before this was called.
   */
  _armTimeout(timeoutMs: number): void {
    if (this._completed) return;
    this._timeoutHandle = setTimeout(() => {
      this._timeoutHandle = null;
      if (this._completed || this._cancelRequested) return;
      this._cancelRequested = true;
      this._settle({
        ok: false,
        error: new CloudCodeError(
          CloudCodeErrorCode.TimedOut,
          `Cloud Code request timed out after ${timeoutMs}ms on the client`,
          { requestId: this.requestId }
        ),
      });
      NativeAppambitCloudCode.cancel(this.requestId).catch(() => {
        // cancel() is best-effort and idempotent on the native side; nothing to surface.
      });
    }, timeoutMs);
  }

  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this._promise.then(onfulfilled, onrejected);
  }

  catch<TResult = never>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null
  ): Promise<T | TResult> {
    return this._promise.catch(onrejected);
  }

  finally(onfinally?: (() => void) | null): Promise<T> {
    return this._promise.finally(onfinally);
  }

  async cancel(): Promise<void> {
    if (this._cancelRequested) return;
    this._cancelRequested = true;

    // Reject the public promise immediately and locally — do not wait for the native
    // cancel() round trip. This mirrors the native contract: on iOS, a cancelled call
    // never invokes its completion at all, so this is the only place Cancelled can
    // ever be delivered to JS; on Android, cancel() removes the pending entry before
    // the request's own onError can fire, for the same reason (see AppambitCloudCodeModule.kt).
    this._settle({
      ok: false,
      error: new CloudCodeError(
        CloudCodeErrorCode.Cancelled,
        'Cloud Code request was cancelled',
        {
          requestId: this.requestId,
        }
      ),
    });

    try {
      await NativeAppambitCloudCode.cancel(this.requestId);
    } catch {
      // cancel() is best-effort and idempotent on the native side; nothing to surface.
    }
  }
}

function callInternal(
  fn: string,
  options: CloudCodeCallOptions = {}
): CloudCodeRequest<CloudCodeResponse> {
  const requestId = nextRequestId();
  const method = options.method ?? 'POST';

  let query: Record<string, string> = {};
  let body: Record<string, unknown> = {};
  let headers: Record<string, string> = {};
  let localError: CloudCodeError | null = null;

  try {
    query = snapshotStringMap(options.query, CloudCodeErrorCode.InvalidQuery);
    headers = snapshotStringMap(
      options.headers,
      CloudCodeErrorCode.InvalidHeader
    );
    if (options.body !== undefined && options.body !== null) {
      const snapshot = snapshotJsonValue(options.body);
      if (typeof snapshot !== 'object' || Array.isArray(snapshot)) {
        throw new CloudCodeError(
          CloudCodeErrorCode.InvalidBody,
          'Cloud Code body must be a JSON object'
        );
      }
      body = snapshot as Record<string, unknown>;
    }
  } catch (e) {
    localError =
      e instanceof CloudCodeError
        ? e
        : new CloudCodeError(CloudCodeErrorCode.InvalidBody, String(e));
  }

  const request = CloudCodeRequest._create<CloudCodeResponse>(
    requestId,
    (settle) => {
      if (localError) {
        settle({ ok: false, error: localError });
        return;
      }

      NativeAppambitCloudCode.call(requestId, fn, method, query, body, headers)
        .then((raw: any) => {
          const rawRequestId =
            typeof raw?.requestId === 'string' ? raw.requestId : null;
          // A successful response always carries a real numeric statusCode from the native
          // layer (Android/iOS both populate it unconditionally) — if it's ever missing or
          // malformed, that's an unexpected bridge shape, not a legitimate "no status" case.
          // Surface it as a Decoding error instead of silently faking `statusCode: 0`,
          // which isn't a valid HTTP status and would hide the real problem from the caller.
          if (typeof raw?.statusCode !== 'number') {
            settle({
              ok: false,
              error: new CloudCodeError(
                CloudCodeErrorCode.Decoding,
                'Cloud Code response is missing a numeric statusCode',
                { requestId: rawRequestId }
              ),
            });
            return;
          }
          settle({
            ok: true,
            value: {
              data: raw?.data ?? null,
              statusCode: raw.statusCode,
              requestId: rawRequestId,
              headers: raw?.headers ?? {},
            },
          });
        })
        .catch((err: unknown) => {
          settle({ ok: false, error: toCloudCodeError(err) });
        });
    }
  );

  if (typeof options.timeout === 'number' && options.timeout > 0) {
    request._armTimeout(options.timeout);
  }

  return request;
}

function callTypedInternal<T>(
  fn: string,
  options: CloudCodeCallOptions & { fromJson: (value: unknown) => T }
): CloudCodeRequest<CloudCodeResult<T>> {
  const { fromJson, ...rest } = options;
  const inner = callInternal(fn, rest);

  return CloudCodeRequest._create<CloudCodeResult<T>>(
    inner.requestId,
    (settle) => {
      inner.then(
        (response) => {
          try {
            const data =
              response.data === null || response.data === undefined
                ? null
                : fromJson(response.data);
            settle({
              ok: true,
              value: {
                data,
                statusCode: response.statusCode,
                requestId: response.requestId,
                headers: response.headers,
              },
            });
          } catch (e) {
            settle({
              ok: false,
              error: new CloudCodeError(
                CloudCodeErrorCode.Decoding,
                e instanceof Error
                  ? e.message
                  : 'Cloud Code response could not be decoded',
                { requestId: response.requestId }
              ),
            });
          }
        },
        (err) => settle({ ok: false, error: err })
      );
    }
  );
}

class CloudCodeApi {
  call(
    fn: string,
    options?: CloudCodeCallOptions
  ): CloudCodeRequest<CloudCodeResponse> {
    return callInternal(fn, options);
  }

  callTyped<T>(
    fn: string,
    options: CloudCodeCallOptions & { fromJson: (value: unknown) => T }
  ): CloudCodeRequest<CloudCodeResult<T>> {
    return callTypedInternal(fn, options);
  }
}

export const CloudCode = new CloudCodeApi();
