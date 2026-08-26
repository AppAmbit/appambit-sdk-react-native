jest.mock('../NativeAppambitCloudCode', () => ({
  __esModule: true,
  default: {
    call: jest.fn(),
    cancel: jest.fn(),
  },
}));

import NativeAppambitCloudCode from '../NativeAppambitCloudCode';
import { CloudCode, CloudCodeError, CloudCodeErrorCode } from '../CloudCode';

const nativeCall = NativeAppambitCloudCode.call as jest.Mock;
const nativeCancel = NativeAppambitCloudCode.cancel as jest.Mock;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  nativeCall.mockReset();
  nativeCancel.mockReset();
  nativeCancel.mockResolvedValue(undefined);
});

describe('CloudCode.call', () => {
  it('snapshots query/body/headers so later mutation of the caller object has no effect', async () => {
    nativeCall.mockResolvedValue({
      data: { ok: true },
      statusCode: 200,
      requestId: 'r1',
      headers: {},
    });

    const body: Record<string, unknown> = { nested: { count: 1 } };
    await CloudCode.call('fn', { body });
    (body.nested as any).count = 999;
    body.extra = 'added-after-call';

    const sentBody = nativeCall.mock.calls[0]?.[4];
    expect(sentBody).toEqual({ nested: { count: 1 } });
  });

  it('rejects locally without invoking the native module when body is not JSON-serializable', async () => {
    const request = CloudCode.call('fn', { body: { fn: () => {} } });
    await expect(request).rejects.toMatchObject({
      code: CloudCodeErrorCode.InvalidBody,
    });
    expect(nativeCall).not.toHaveBeenCalled();
  });

  it('rejects locally for a circular body reference without invoking the native module', async () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const request = CloudCode.call('fn', { body: circular });
    await expect(request).rejects.toMatchObject({
      code: CloudCodeErrorCode.InvalidBody,
    });
    expect(nativeCall).not.toHaveBeenCalled();
  });

  it('generates distinct requestIds for two calls fired in the same tick', async () => {
    nativeCall.mockResolvedValue({
      data: null,
      statusCode: 200,
      requestId: null,
      headers: {},
    });
    const a = CloudCode.call('fn-a');
    const b = CloudCode.call('fn-b');
    await Promise.all([a, b]);
    const idA = nativeCall.mock.calls[0]?.[0];
    const idB = nativeCall.mock.calls[1]?.[0];
    expect(idA).not.toEqual(idB);
  });

  it.each([
    ['NOT_INITIALIZED', CloudCodeErrorCode.NotInitialized],
    ['INVALID_FUNCTION', CloudCodeErrorCode.InvalidFunction],
    ['INVALID_METHOD', CloudCodeErrorCode.InvalidMethod],
    ['INVALID_QUERY', CloudCodeErrorCode.InvalidQuery],
    ['INVALID_BODY', CloudCodeErrorCode.InvalidBody],
    ['INVALID_HEADER', CloudCodeErrorCode.InvalidHeader],
    ['INVALID_RESPONSE_TYPE', CloudCodeErrorCode.InvalidResponseType],
    ['CANCELLED', CloudCodeErrorCode.Cancelled],
    ['NETWORK_UNAVAILABLE', CloudCodeErrorCode.NetworkUnavailable],
    ['TIMED_OUT', CloudCodeErrorCode.TimedOut],
    ['INVALID_URL', CloudCodeErrorCode.InvalidUrl],
    ['TRANSPORT', CloudCodeErrorCode.Transport],
    ['DECODING', CloudCodeErrorCode.Decoding],
    ['HTTP', CloudCodeErrorCode.Http],
    ['SOMETHING_NEW_THE_NATIVE_SDK_ADDED', CloudCodeErrorCode.Unknown],
  ])(
    'maps native wire code %s to CloudCodeErrorCode.%s',
    async (wireCode, expected) => {
      nativeCall.mockRejectedValue({
        code: wireCode,
        message: 'native failure',
        userInfo: { code: wireCode, statusCode: 404, requestId: 'r-err' },
      });
      const request = CloudCode.call('fn');
      await expect(request).rejects.toMatchObject({ code: expected });
    }
  );

  it('cancel() rejects the public promise with Cancelled immediately, without waiting on the native mock', async () => {
    const native = deferred<any>();
    nativeCall.mockReturnValue(native.promise);

    const request = CloudCode.call('fn');
    const cancelPromise = request.cancel();

    // cancel() settles the public promise synchronously before its own first `await`,
    // so this assertion doesn't need to wait for cancelPromise (or the native mock) to settle.
    await expect(request).rejects.toMatchObject({
      code: CloudCodeErrorCode.Cancelled,
    });
    await cancelPromise;

    expect(nativeCancel).toHaveBeenCalledTimes(1);
    // the native call promise is deliberately left unsettled — cancel() must not depend on it.
  });

  it('cancel() called twice only invokes native cancel once', async () => {
    const native = deferred<any>();
    nativeCall.mockReturnValue(native.promise);

    const request = CloudCode.call('fn');
    request.catch(() => {});

    await request.cancel();
    await request.cancel();

    expect(nativeCancel).toHaveBeenCalledTimes(1);
  });

  it('omits an undefined body field instead of sending it as explicit null', async () => {
    nativeCall.mockResolvedValue({
      data: null,
      statusCode: 200,
      requestId: null,
      headers: {},
    });

    await CloudCode.call('fn', {
      body: { title: 'ok', description: undefined },
    });

    const sentBody = nativeCall.mock.calls[0]?.[4];
    expect(sentBody).toEqual({ title: 'ok' });
    expect(sentBody).not.toHaveProperty('description');
  });

  it('still sends an explicit null body field as null (not omitted)', async () => {
    nativeCall.mockResolvedValue({
      data: null,
      statusCode: 200,
      requestId: null,
      headers: {},
    });

    await CloudCode.call('fn', { body: { title: 'ok', description: null } });

    const sentBody = nativeCall.mock.calls[0]?.[4];
    expect(sentBody).toEqual({ title: 'ok', description: null });
  });

  it('converts an undefined array element to null (matches JSON.stringify)', async () => {
    nativeCall.mockResolvedValue({
      data: null,
      statusCode: 200,
      requestId: null,
      headers: {},
    });

    await CloudCode.call('fn', { body: { list: [1, undefined, 3] } });

    const sentBody = nativeCall.mock.calls[0]?.[4];
    expect(sentBody).toEqual({ list: [1, null, 3] });
  });

  it('reports a non-string query value as InvalidQuery with the key under `query`, not `header`', async () => {
    const request = CloudCode.call('fn', { query: { limit: 20 as any } });
    await expect(request).rejects.toMatchObject({
      code: CloudCodeErrorCode.InvalidQuery,
      query: 'limit',
      header: undefined,
    });
    expect(nativeCall).not.toHaveBeenCalled();
  });

  it('reports a non-string header value as InvalidHeader with the key under `header`', async () => {
    const request = CloudCode.call('fn', {
      headers: { 'X-Count': 20 as any },
    });
    await expect(request).rejects.toMatchObject({
      code: CloudCodeErrorCode.InvalidHeader,
      header: 'X-Count',
      query: undefined,
    });
    expect(nativeCall).not.toHaveBeenCalled();
  });

  it('rejects with Decoding instead of a fake statusCode: 0 when the bridge response has no numeric statusCode', async () => {
    nativeCall.mockResolvedValue({
      data: { ok: true },
      requestId: 'r1',
      headers: {},
      // statusCode intentionally omitted to simulate a malformed bridge payload
    });

    const request = CloudCode.call('fn');
    await expect(request).rejects.toMatchObject({
      code: CloudCodeErrorCode.Decoding,
    });
  });

  describe('timeout (opt-in)', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('rejects with TimedOut and cancels the native request once the deadline elapses', async () => {
      const native = deferred<any>();
      nativeCall.mockReturnValue(native.promise);

      const request = CloudCode.call('fn', { timeout: 5000 });
      request.catch(() => {});

      jest.advanceTimersByTime(5000);
      await expect(request).rejects.toMatchObject({
        code: CloudCodeErrorCode.TimedOut,
      });
      const sentRequestId = nativeCall.mock.calls[0]?.[0];
      expect(nativeCancel).toHaveBeenCalledTimes(1);
      expect(nativeCancel).toHaveBeenCalledWith(sentRequestId);
    });

    it('never fires the timeout when the call resolves first (no leaked timer/late rejection)', async () => {
      nativeCall.mockResolvedValue({
        data: { ok: true },
        statusCode: 200,
        requestId: 'r1',
        headers: {},
      });

      const result = await CloudCode.call('fn', { timeout: 5000 });
      expect(result.statusCode).toBe(200);

      jest.advanceTimersByTime(5000);
      expect(nativeCancel).not.toHaveBeenCalled();
    });

    it('does not arm a timer at all when timeout is omitted (default, no-timeout behavior unchanged)', async () => {
      const native = deferred<any>();
      nativeCall.mockReturnValue(native.promise);

      const request = CloudCode.call('fn');
      request.catch(() => {});

      jest.advanceTimersByTime(10 * 60 * 1000);
      expect(nativeCancel).not.toHaveBeenCalled();

      native.resolve({
        data: null,
        statusCode: 200,
        requestId: null,
        headers: {},
      });
      await expect(request).resolves.toMatchObject({ statusCode: 200 });
    });

    it('cancel() before the deadline suppresses the later timeout firing', async () => {
      const native = deferred<any>();
      nativeCall.mockReturnValue(native.promise);

      const request = CloudCode.call('fn', { timeout: 5000 });
      request.catch(() => {});
      await request.cancel();
      expect(nativeCancel).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(5000);
      // still just the one cancel() call from above — the timeout must not fire a second one
      expect(nativeCancel).toHaveBeenCalledTimes(1);
    });
  });
});

describe('CloudCode.callTyped', () => {
  it('applies fromJson only when data is present', async () => {
    nativeCall.mockResolvedValue({
      data: { id: 1 },
      statusCode: 200,
      requestId: 'r1',
      headers: {},
    });
    const fromJson = jest.fn((v: any) => ({ id: v.id as number }));

    const result = await CloudCode.callTyped('fn', { fromJson });

    expect(fromJson).toHaveBeenCalledWith({ id: 1 });
    expect(result.data).toEqual({ id: 1 });
  });

  it('returns data: null without calling fromJson for a 204/null response', async () => {
    nativeCall.mockResolvedValue({
      data: null,
      statusCode: 204,
      requestId: null,
      headers: {},
    });
    const fromJson = jest.fn();

    const result = await CloudCode.callTyped('fn', { fromJson });

    expect(fromJson).not.toHaveBeenCalled();
    expect(result.data).toBeNull();
  });

  it('wraps a throwing fromJson into a CloudCodeError with code Decoding', async () => {
    nativeCall.mockResolvedValue({
      data: { id: 1 },
      statusCode: 200,
      requestId: 'r1',
      headers: {},
    });
    const fromJson = () => {
      throw new Error('bad shape');
    };

    const request = CloudCode.callTyped('fn', { fromJson });
    await expect(request).rejects.toBeInstanceOf(CloudCodeError);
    await expect(request).rejects.toMatchObject({
      code: CloudCodeErrorCode.Decoding,
    });
  });
});
