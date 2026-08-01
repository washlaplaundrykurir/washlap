import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET, PUT } from "./route";

import { DEFAULT_TICKET_MESSAGE_TEMPLATE } from "@/lib/whatsapp";

const h = vi.hoisted(() => {
  const controller = {
    row: null as { content: string; updated_at: string } | null,
    upserts: [] as Record<string, unknown>[],
    reset() {
      this.row = null;
      this.upserts = [];
    },
  };

  class Builder {
    private payload: Record<string, unknown> | null = null;

    select() {
      return this;
    }

    eq() {
      return this;
    }

    upsert(payload: Record<string, unknown>) {
      this.payload = payload;
      controller.upserts.push(payload);

      return this;
    }

    maybeSingle() {
      return Promise.resolve({ data: controller.row, error: null });
    }

    single() {
      return Promise.resolve({
        data: this.payload,
        error: null,
      });
    }
  }

  return {
    controller,
    makeAdminClient: () => ({ from: () => new Builder() }),
  };
});

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: vi.fn(async () => ({
    user: { id: "admin-1", role: "admin" },
    error: null,
  })),
}));

vi.mock("@/utils/supabase/server", () => ({
  createSupabaseAdmin: () => h.makeAdminClient(),
}));

const request = (body: unknown) =>
  ({ json: async () => body }) as Parameters<typeof PUT>[0];

beforeEach(() => {
  h.controller.reset();
  vi.clearAllMocks();
});

describe("admin message-template API", () => {
  it("returns the built-in template when no saved row exists", async () => {
    const response = await GET();
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.template).toBe(DEFAULT_TICKET_MESSAGE_TEMPLATE);
  });

  it("rejects an empty template without writing to the database", async () => {
    const response = await PUT(request({ template: "   " }));

    expect(response.status).toBe(400);
    expect(h.controller.upserts).toHaveLength(0);
  });

  it("upserts a valid editable template", async () => {
    const template = "Tiket {nomor_tiket} untuk {nama}";
    const response = await PUT(request({ template }));
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(h.controller.upserts).toHaveLength(1);
    expect(h.controller.upserts[0]).toMatchObject({
      code: "ticket_copy",
      content: template,
    });
    expect(result.template).toBe(template);
  });
});
