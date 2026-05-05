import { createApp } from "./app";
import type { Env } from "./env";
import { initProtocolRegistry } from "./protocols/registry";

const ready = initProtocolRegistry();
const app = createApp();

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    await ready;
    return app.fetch(request, env, ctx);
  },
};
