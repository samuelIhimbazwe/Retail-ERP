import { AsyncLocalStorage } from "async_hooks";
import type { Session } from "next-auth";

export type AppSession = Session;

export const sessionAls = new AsyncLocalStorage<AppSession>();

export function getAlsSession() {
  return sessionAls.getStore();
}

export function runWithSession<T>(session: AppSession, fn: () => Promise<T>) {
  return sessionAls.run(session, fn);
}
