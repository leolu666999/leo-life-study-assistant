import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";

type DataChangeEvent = {
  id: string;
  type: "data-change";
  entity: string;
  action: string;
  createdAt: string;
};

type RealtimeGlobal = {
  emitter?: EventEmitter;
};

const realtimeGlobal = globalThis as typeof globalThis & { leoRealtime?: RealtimeGlobal };
const state = realtimeGlobal.leoRealtime ?? (realtimeGlobal.leoRealtime = {});

export function getRealtimeEmitter() {
  if (!state.emitter) {
    state.emitter = new EventEmitter();
    state.emitter.setMaxListeners(100);
  }
  return state.emitter;
}

export function broadcastDataChange(entity: string, action: string) {
  const event: DataChangeEvent = {
    id: randomUUID(),
    type: "data-change",
    entity,
    action,
    createdAt: new Date().toISOString()
  };
  getRealtimeEmitter().emit("data-change", event);
  return event;
}

export function mutationResponse<T>(data: T, init: ResponseInit | number = 200, entity = "data", action = "change") {
  broadcastDataChange(entity, action);
  const responseInit = typeof init === "number" ? { status: init } : init;
  return Response.json(data, responseInit);
}

export type { DataChangeEvent };
