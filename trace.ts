import http from "http";
import { Express, Request, Response as ExpressResponse, NextFunction } from "express";
import { Worker } from "worker_threads";
import { randomUUID } from "crypto";

const loggerWorker = {
  postMessage: console.log,
};
let loggerDump = new Map<string, string>();
let tmSet;
let logStrategy: "real time" | "delay all" | "delay each" | "await each" = "delay each"; //await each";

if (logStrategy === "delay each") tmSet = {};
const logger = (trace: string, message: string, flush: boolean = false) => {
  if (logStrategy === "real time") return loggerWorker.postMessage(message);
  else if (logStrategy === "delay all") {
    if (tmSet) clearTimeout(tmSet);
    tmSet = setTimeout(() => Object.keys(loggerDump).forEach((traceId) => flushPool(traceId)), 500);
  } else if (logStrategy === "delay each") {
    if (tmSet[trace]) clearTimeout(tmSet[trace]);
    tmSet[trace] = setTimeout(() => flushPool(trace), 500);
  }
  loggerDump.set(trace, `${loggerDump.get(trace) ?? ""}${trace}${message}\n`);
  if (logStrategy === "await each" && flush) flushPool(trace);
};

const flushPool = (trace: string) => {
  const message = `${loggerDump.get(trace)}`;
  if (!message) return;
  loggerWorker.postMessage(message.slice(0, -1));
  loggerDump.delete(trace);
};

type Method = "get" | "post" | "options" | "all" | "patch" | "delete" | "put" | "head" | "connect" | "trace";

type Route = {
  path: string;
  stack: RouteStack[];
  methods: Record<Method, boolean>;
};

type Stack = {
  handle: Function;
  name: string;
  params?: undefined;
  path?: undefined;
  keys: Record<string, string | boolean | number>[];
  regexp: RegExp;
  mutated: boolean;
};

// const ROUTE = "Route", MIDDLEWARE = "Middleware", ROUTE_MIDDLEWARE = 'Route Middleware';
enum HandlerType {
  ROUTE = "Route",
  MIDDLEWARE = "Middleware",
  ROUTE_MIDDLEWARE = "Route Middleware",
}

type StackItemType = HandlerType;
type StackItem<T extends StackItemType | undefined = undefined> = Stack & {
  route: T extends undefined ? undefined | Route : T extends HandlerType.ROUTE ? Route : undefined;
};

type RouteStack<T extends Method = Method> = Stack & {
  method: T;
};

const getStackItemType = (stackItem: StackItem): StackItemType => (stackItem.route ? HandlerType.ROUTE : HandlerType.MIDDLEWARE);
const stackItemIsMiddleware = (stackItem: StackItem): stackItem is StackItem<HandlerType.MIDDLEWARE> => !stackItem.route;
const stackItemIsRoute = (stackItem: StackItem): stackItem is StackItem<HandlerType.ROUTE | HandlerType.ROUTE_MIDDLEWARE> => !!stackItem.route;

interface Response extends ExpressResponse {
  routeEntered: boolean;
  stackTrace: string;
  routeTriggerIdx: number;
  currentRouteStackIndex: number;
  currentRouteStackName: string;
  __init: number;
  nextMiddleware: boolean;
  __is_finished_printedx: number | undefined;
  stackInit: number;
}

const COLOR = Object.freeze({
  bgRed: "\x1b[41m",
  fgWhite: "\x1b[37m",
  fgRed: "\x1b[31m",
  fgYellow: "\x1b[33m",
  fgBlue: "\x1b[34m",
  fgGreen: "\x1b[32m",
  fgMagenta: "\x1b[35m",
  fgCyan: "\x1b[36m",
  reset: "\x1b[0m",
});

const getStatusCodeColor = (statusCode) => (statusCode >= 200 && statusCode <= 299 ? COLOR.fgGreen : statusCode >= 400 ? COLOR.fgRed : COLOR.fgWhite);

type RouteHandlerStage = "JOIN" | "HANDLER" | "OPENER" | "RESPONSE SENDED" | "RESPONSE TOTAL" | "CLEANUP HANDLER" | "TOTAL HANDLER";
const METHOD_COLOR: Record<Uppercase<Method>, (typeof COLOR)[keyof typeof COLOR]> = Object.freeze({
  GET: COLOR.fgGreen,
  PATCH: COLOR.fgCyan,
  PUT: COLOR.fgCyan,
  DELETE: COLOR.fgRed,
  POST: COLOR.fgYellow,
  HEAD: COLOR.fgBlue,
  OPTIONS: COLOR.fgBlue,
  CONNECT: COLOR.fgBlue,
  TRACE: COLOR.fgBlue,
  ALL: COLOR.fgBlue,
});
const ROUTE_HANDLER_STAGE_TAG: Record<Extract<RouteHandlerStage, "RESPONSE SENDED" | "CLEANUP HANDLER" | "TOTAL HANDLER">, string> = Object.freeze({
  "TOTAL HANDLER": "(total) ",
  "CLEANUP HANDLER": "(cleanup) ",
  "RESPONSE SENDED": "(send response) ",
});
const formatPayload = (
  payload:
    | ({
        type: "wrapper";
        method: Method;
        reqUrl: string;
      } & ({ action: "start" } | { action: "finish"; timing: number }))
    | ({
        type: "handler";
        reqUrl: string;
        method: Method;
        handlerName: string;
      } & (
        | { isRouteHandler: false }
        | ({ isRouteHandler: true } & (
            | {
                routeHandlerStage: Extract<RouteHandlerStage, "JOIN" | "HANDLER">;
                timing: number;
              }
            | {
                routeHandlerStage: Extract<RouteHandlerStage, "OPENER">;
              }
            | {
                routeHandlerStage: Extract<RouteHandlerStage, "RESPONSE SENDED" | "CLEANUP HANDLER" | "TOTAL HANDLER" | "RESPONSE TOTAL">;
                statusCode: number;
                timing: number;
              }
          ))
      ))
) => {
  switch (payload.type) {
    case "wrapper":
      // GET / started
      return `${METHOD_COLOR[payload.method.toUpperCase()]}${payload.method} ${payload.reqUrl} ${COLOR.reset}\x1b[1m${payload.action}${COLOR.reset}${payload.action === "start" ? "" : `, elapsed time since begin: ${COLOR.fgYellow}${payload.timing} ms${COLOR.reset}`}`;
    case "handler":
      // Middleware query 0.05143131314363 ms
      if (!payload.isRouteHandler) return `${COLOR.fgCyan}${HandlerType.MIDDLEWARE} ${COLOR.fgGreen}${payload.handlerName} ${COLOR.fgYellow}${payload.timing} ms${COLOR.reset}`;

      const handlerParent = `${payload.method} ${payload.reqUrl}`;
      // Route GET /
      if (payload.routeHandlerStage === "JOIN") return `${COLOR.fgMagenta}${HandlerType.ROUTE} ${METHOD_COLOR[payload.method.toUpperCase()]}${handlerParent}${COLOR.reset}`;

      let padStart = " ".repeat(`${HandlerType.ROUTE} ${handlerParent}`.length);
      //            <anonymous (0)>  0.05143131314363 ms
      if (payload.routeHandlerStage === "HANDLER" || payload.routeHandlerStage === "OPENER") return `${padStart}${COLOR.fgGreen}${payload.handlerName}${payload.routeHandlerStage === "OPENER" ? "" : ` ${COLOR.fgYellow}${payload.timing} ms`}${COLOR.reset}`;

      //                            (send response) 55.36708399653435 ms
      padStart += " ".repeat(payload.handlerName.length);
      if (payload.routeHandlerStage === "RESPONSE TOTAL") return ` ${getStatusCodeColor(payload.statusCode)}${payload.statusCode} ${http.STATUS_CODES[payload.statusCode]}${COLOR.reset}, total elapsed time: ${COLOR.fgYellow}${payload.timing} ms${COLOR.reset}`;
      return `${ROUTE_HANDLER_STAGE_TAG[payload.routeHandlerStage]}${COLOR.fgYellow}${payload.timing} ms${COLOR.reset}`;
  }
};

const printStack = (stackItemType: StackItemType, statusCode: number, name: string, method: Method | "", init: number, stackTrace: string) => {
  const statusCodeColor = getStatusCodeColor(statusCode);
  logger(
    stackTrace,
    `${stackItemType === "Middleware" ? COLOR.fgCyan : stackItemType === "Route Middleware" ? COLOR.fgBlue : COLOR.fgMagenta}${stackItemType === "Route Middleware" ? "Middleware" : stackItemType} ${COLOR.fgGreen}${["Route", "Route Middleware"].includes(stackItemType) && method ? `${method} ` : ""}${name} ${COLOR.fgYellow}${performance.now() - init} ms${
      stackItemType === "Route" ? ` ${statusCodeColor}${statusCode} ${http.STATUS_CODES[statusCode]}` : ""
    }${COLOR.reset}`
  );
};

const printStackState = async (fn: Function, name: string, stackItem: StackItem, req: Request, res: Response, next: NextFunction, noNext = true, stackTrace: string) => {
  const init = performance.now();
  return await fn(req, res, function (err: any) {
    if (noNext) printStack(getStackItemType(stackItem), res.statusCode, name, req.method as Method, init, stackTrace);
    return next(err);
  });
};

export const trace = (app: Express) => {
  let stack = app._router.stack as StackItem[];
  for (const stackItem of stack) {
    const { handle, route } = stackItem;
    stackItem.handle = async function (req: Request, res: Response, next: NextFunction) {
      const name = (handle.name === "bound dispatch" ? route?.path : handle.name) || "<anonymous>";
      const method = req.method as Method;
      // Route
      if (getStackItemType(stackItem) === "Route") {
        if (!res.routeEntered) {
          res.routeEntered = true;
          logger(res.stackTrace, `${COLOR.fgMagenta}Route ${COLOR.fgGreen}${method} ${name}${COLOR.reset}`);
        }
        for (let i = 0; i < stackItem.route.stack.length; i++) {
          const routeStack = stackItem.route.stack[i],
            routeIdx = i;
          if (routeStack.mutated) break;
          routeStack.mutated = true;
          const routeStackHandle = routeStack.handle;
          routeStack.handle = async function (req: Request, res: Response, next: NextFunction) {
            const routeStackName = routeStack.name === "<anonymous>" ? `<anonymous (${routeIdx})>` : routeStack.name;

            if (!res.writableEnded) res.routeTriggerIdx = routeIdx;
            res.currentRouteStackIndex = routeIdx;
            res.currentRouteStackName = routeStackName;
            const init = performance.now();
            res.__init = init;
            await routeStackHandle(req, res, function (err) {
              res.nextMiddleware = true;
              return next(err);
            });

            res.nextMiddleware = false;
            if (res.routeTriggerIdx === routeIdx && res.__is_finished_printedx) {
              const leftPadding = " ".repeat(`Middleware ${routeStackName} `.length);
              logger(res.stackTrace, `${leftPadding}(cleanup) ${COLOR.fgYellow}${performance.now() - init - res.__is_finished_printedx} ms${COLOR.reset}`);
              logger(res.stackTrace, `${leftPadding}(total) ${COLOR.fgYellow}${performance.now() - init} ms${COLOR.reset}`);
            } else {
              if ((res.currentRouteStackIndex !== routeIdx || res.__is_finished_printedx) && res.routeTriggerIdx !== routeIdx) {
                // Fired when routeTriggerIdx is not the first handler
                printStack("Route Middleware", res.statusCode, routeStackName, "", init, res.stackTrace);
                /* const statusCodeColor = getStatusCodeColor(res.statusCode);
                `${stackItemType === "Middleware" ? COLOR.fgCyan : stackItemType === "Route Middleware" ? COLOR.fgBlue : COLOR.fgMagenta}${stackItemType === "Route Middleware" ? "Middleware" : stackItemType} ${COLOR.fgGreen}${["Route", "Route Middleware"].includes(stackItemType) && method ? `${method} ` : ""}${name} ${COLOR.fgYellow}${performance.now() - init} ms${
                  stackItemType === "Route" ? ` ${statusCodeColor}${res.statusCode} ${http.STATUS_CODES[res.statusCode]}` : ""
                }${COLOR.reset}`;
                console.log({ preparedTwo: `${COLOR.fgBlue}Middleware ${COLOR.fgGreen}${routeStackName}${COLOR.reset}` }); */
              } else if (res.routeTriggerIdx !== res.currentRouteStackIndex) {
                // Fired when routeTriggerIdx is first handler
                //logger(res.stackTrace, `${COLOR.fgBlue}Middleware ${COLOR.fgGreen}${routeStackName}${COLOR.reset}`);
                logger(res.stackTrace, formatPayload({ type: "handler", isRouteHandler: true, routeHandlerStage: "OPENER", handlerName: routeStackName, method, reqUrl: req.originalUrl }));
              }
            }
            if (!res.nextMiddleware && routeIdx === res.currentRouteStackIndex)
              /* logger(
                res.stackTrace,
                `${COLOR.fgGreen}${method} ${req.originalUrl}${
                  COLOR.reset
                } \x1b[1mfinished${COLOR.reset}, elapsed time since begin: ${
                  COLOR.fgYellow
                }${performance.now() - res.stackInit} ms${COLOR.reset}`,
                true
              ); */
              logger(res.stackTrace, formatPayload({ type: "wrapper", action: "finish", method, reqUrl: req.originalUrl, timing: performance.now() - res.stackInit }), true);
          };
        }
      }
      return await printStackState(handle, name, stackItem, req, res, next, getStackItemType(stackItem) !== "Route", res.stackTrace);
    };
  }
  app.use(function initTracer(req, res: Response, next) {
    res.stackTrace = randomUUID();
    logger(res.stackTrace, `${COLOR.fgGreen}${req.method} ${req.originalUrl} ${COLOR.reset}\x1b[1mstarted${COLOR.reset}`);
    res.stackInit = performance.now();
    res.once("finish", () => {
      res.__is_finished_printedx = performance.now() - res.__init;
      const leftPadding = " ".repeat(`Middleware ${res.currentRouteStackName} `.length);

      if (res.routeTriggerIdx === res.currentRouteStackIndex) logger(res.stackTrace, `${COLOR.fgBlue}Middleware ${COLOR.fgGreen}${res.currentRouteStackName}${COLOR.reset}`);
      logger(res.stackTrace, `${leftPadding}(send response) ${COLOR.fgYellow}${performance.now() - res.__init} ms${COLOR.reset}`);
      logger(res.stackTrace, `${leftPadding}\x1b[1m${getStatusCodeColor(res.statusCode)}${res.statusCode} ${http.STATUS_CODES[res.statusCode]}${COLOR.reset}, total elapsed time: ${COLOR.fgYellow}${performance.now() - res.stackInit} ms${COLOR.reset}`);
    });
    next();
  });
  app._router.stack.unshift(app._router.stack.pop());

  return app;
};
