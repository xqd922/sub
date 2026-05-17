import { Hono } from "hono";
import type { AppEnv } from "./env";
import { bearerToken, validateAdminCredentials, validateAdminToken } from "./auth/service";
import { errors, toAppError } from "./lib/errors";
import { deleteRecord, getRecord, getStats, listRecords } from "./kv/records";
import { createShortLink, deleteShortLink, listShortLinks, touchShortLink } from "./shorten/service";
import { handleConvertRequest } from "./services/convert";

export function createApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.onError((err) => {
    const appError = toAppError(err);
    return Response.json(appError.toJSON(), { status: appError.status });
  });

  app.get("/sub", (c) => handleConvertRequest(c.env, c.req.raw, c.executionCtx));

  app.post("/api/shorten", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { url?: string };
    if (!body.url) throw errors.missingParam("url");
    return c.json(await createShortLink(c.env, body.url));
  });

  app.get("/api/shorten", async (c) => {
    const url = c.req.query("url");
    if (!url) throw errors.missingParam("url");
    return c.json(await createShortLink(c.env, url));
  });

  app.get("/s/:id", async (c) => {
    const link = await touchShortLink(c.env, c.req.param("id"));
    if (!link) throw errors.notFound("Short link");
    return c.redirect(link.targetUrl, 302);
  });

  app.post("/api/admin/login", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { username?: string; password?: string };
    const token = await validateAdminCredentials(c.env, body.username ?? "", body.password ?? "");
    if (!token) throw errors.authFailed();
    return c.json({ success: true, token });
  });

  app.use("/api/admin/*", async (c, next) => {
    if (!(await validateAdminToken(c.env, bearerToken(c.req.raw)))) {
      throw errors.authRequired();
    }
    await next();
  });

  app.get("/api/admin/records", async (c) => c.json(await listRecords(c.env)));
  app.get("/api/admin/records/:id", async (c) => {
    const record = await getRecord(c.env, c.req.param("id"));
    if (!record) throw errors.notFound("Record");
    return c.json(record);
  });
  app.delete("/api/admin/records/:id", async (c) => {
    return c.json({ ok: await deleteRecord(c.env, c.req.param("id")) });
  });
  app.get("/api/admin/shortlinks", async (c) => c.json(await listShortLinks(c.env)));
  app.delete("/api/admin/shortlinks/:id", async (c) => {
    return c.json({ ok: await deleteShortLink(c.env, c.req.param("id")) });
  });
  app.get("/api/admin/stats", async (c) => c.json(await getStats(c.env)));

  app.notFound(async (c) => {
    if (!c.env.ASSETS) {
      return new Response("Assets not bound", { status: 500 });
    }
    try {
      return await c.env.ASSETS.fetch(c.req.raw);
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });

  return app;
}
