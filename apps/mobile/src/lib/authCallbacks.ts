type ClearAuthFn = () => Promise<void>;

let _clearAuth: ClearAuthFn = async () => {};

export function registerClearAuth(fn: ClearAuthFn): void {
  _clearAuth = fn;
}

export async function clearAuth(): Promise<void> {
  await _clearAuth();
}
