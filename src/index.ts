import { Elysia } from "elysia";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";

export default new Elysia({
  adapter: CloudflareAdapter,
})
  .get("/", () => "hello world world world")
  .compile();
