import { describe, expect, it, vi, beforeEach } from "vitest";

// Lightweight smoke test that POSTing to /api/locale persists the cookie.
// We stub the response cookie API since Next.js NextResponse isn't directly
// constructable in a vitest process without a request context.
describe("/api/locale", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("rejects unknown locales", async () => {
    const { POST } = await import("@/app/api/locale/route");
    const req = new Request("http://localhost/api/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: "fr" }),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(422);
  });

  it("rejects malformed bodies", async () => {
    const { POST } = await import("@/app/api/locale/route");
    const req = new Request("http://localhost/api/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not json",
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });

  it("accepts a known locale and sets the cookie", async () => {
    const { POST } = await import("@/app/api/locale/route");
    const req = new Request("http://localhost/api/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: "en" }),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("locale=en");
  });
});
