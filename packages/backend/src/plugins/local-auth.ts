import { Elysia } from "elysia";
import { isTraceId } from "@lorelum/log";
import { backendErrorBody, type BackendErrorCode } from "../protocol/errors";
import {
  BACKEND_HOST,
  BACKEND_ROUTES,
  DIAGNOSTIC_LEVEL_HEADER,
  MAX_BODY_BYTES,
  TRACE_ID_HEADER,
} from "../protocol/constants";

export function reject(status: number, code: BackendErrorCode): Response {
  return Response.json(backendErrorBody(code), { status });
}

/** Shared transport boundary, scoped to the application that installs this plugin. */
export function localBoundary(port: number, authenticate: (credential: string) => boolean) {
  let authority = `${BACKEND_HOST}:${port}`;
  return new Elysia({ name: "lorelum.local-boundary" })
    .onStart(({ server }) => {
      if (server?.port !== undefined) authority = `${BACKEND_HOST}:${server.port}`;
    })
    .onRequest(({ request }) => {
      if (request.headers.has("origin")) return reject(403, "backend.unauthorized");
      if (request.headers.get("host") !== authority) return reject(400, "backend.invalid-request");
      const publicIdentity =
        request.method === "GET" && new URL(request.url).pathname === BACKEND_ROUTES.identity;
      if (publicIdentity) {
        if (request.headers.has("authorization") || request.headers.has("cookie"))
          return reject(401, "backend.unauthorized");
      } else return requireAuthorization(request, authenticate);
    })
    .as("scoped");
}

/** Installed only on protected controllers, before parsing any request body. */
export function requireAuthorization(
  request: Request,
  authenticate: (credential: string) => boolean,
): Response | undefined {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ") || !authenticate(header.slice(7))) {
    return reject(401, "backend.unauthorized");
  }
  const traceId = request.headers.get(TRACE_ID_HEADER);
  if (traceId !== null && !isTraceId(traceId)) return reject(400, "backend.invalid-request");
  const diagnosticLevel = request.headers.get(DIAGNOSTIC_LEVEL_HEADER);
  if (diagnosticLevel !== null && diagnosticLevel !== "debug") {
    return reject(400, "backend.invalid-request");
  }
}

/** The trace is validated by the authentication boundary and is never an authority credential. */
export function requestTraceId(request: Request) {
  const traceId = request.headers.get(TRACE_ID_HEADER);
  return traceId === null ? undefined : isTraceId(traceId) ? traceId : undefined;
}

/** The local authenticated client may widen only this request's persisted detail. */
export function requestDiagnosticLevel(request: Request): "debug" | undefined {
  return request.headers.get(DIAGNOSTIC_LEVEL_HEADER) === "debug" ? "debug" : undefined;
}

export function requireJson(request: Request): Response | undefined {
  const type = request.headers.get("content-type") ?? "";
  const length = request.headers.get("content-length");
  if (
    !/^application\/json(?:\s*;|\s*$)/i.test(type) ||
    (length !== null && (!/^[0-9]+$/.test(length) || Number(length) > MAX_BODY_BYTES))
  ) {
    return reject(400, "backend.invalid-request");
  }
}
