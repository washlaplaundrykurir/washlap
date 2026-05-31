// @vitest-environment jsdom
/**
 * Component tests for the admin ticket-creation success state and submit flow
 * (task 8.4). These cover the post-save WhatsApp UX and the blocking
 * duplicate-ticket confirmation orchestration.
 *
 * Feature: admin-ticket-wa-and-duplicate-warnings
 * Requirements: 1.1, 1.9, 1.10, 1.11, 1.12, 3.7, 4.1, 4.2, 4.3
 *
 * The pure helpers in `@/lib/whatsapp` are used REAL (not mocked) so the WA URL
 * asserted in the test is computed exactly as the component computes it. Only
 * `useToast` (toasts), `window.open`, and `fetch` are mocked.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
  beforeAll,
} from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

import {
  type TicketWaData,
  buildWaUrl,
  buildTicketWaMessage,
} from "@/lib/whatsapp";

// --- Mock the toast provider so `useToast()` returns a stable spy ---------
const { mockShowToast } = vi.hoisted(() => ({ mockShowToast: vi.fn() }));

vi.mock("@/components/ToastProvider", () => ({
  useToast: () => ({ showToast: mockShowToast }),
  showToast: mockShowToast,
}));

// Import AFTER the mock is registered.
import AdminPage from "@/app/admin/page";

// --- jsdom polyfills required by HeroUI / react-aria ----------------------
beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList;
  }

  if (!(global as any).ResizeObserver) {
    (global as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }

  if (!(global as any).IntersectionObserver) {
    (global as any).IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    };
  }

  // react-aria / user-event interactions need pointer capture + scrollIntoView.
  if (!Element.prototype.hasPointerCapture)
    Element.prototype.hasPointerCapture = () => false;
  if (!Element.prototype.setPointerCapture)
    Element.prototype.setPointerCapture = () => {};
  if (!Element.prototype.releasePointerCapture)
    Element.prototype.releasePointerCapture = () => {};
  if (!Element.prototype.scrollIntoView)
    Element.prototype.scrollIntoView = () => {};
});

// --- fetch router ---------------------------------------------------------
type MockResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

function jsonResponse(
  body: unknown,
  { ok = true, status = 200 }: { ok?: boolean; status?: number } = {},
): Promise<MockResponse> {
  return Promise.resolve({ ok, status, json: () => Promise.resolve(body) });
}

// Ordered log of network/toast events for the call-ordering test (Req 4.1/4.2).
let events: string[] = [];

// Per-route handlers; tests override the ones they care about.
let handlers: {
  list: () => Promise<MockResponse>;
  me: () => Promise<MockResponse>;
  lookup: () => Promise<MockResponse>;
  checkDuplicate: (url: string) => Promise<MockResponse>;
  postOrders: () => Promise<MockResponse>;
};

const fetchMock = vi.fn();
let openSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  events = [];

  handlers = {
    list: () => jsonResponse({ data: [] }),
    me: () => jsonResponse({ user: { full_name: "Tester" } }),
    lookup: () => jsonResponse({ data: null }),
    checkDuplicate: () => jsonResponse({ exists: false }),
    postOrders: () =>
      jsonResponse({ success: true, orders: [], warnings: [] }),
  };

  fetchMock.mockImplementation((input: unknown, init?: { method?: string }) => {
    const url =
      typeof input === "string"
        ? input
        : ((input as { url?: string })?.url ?? String(input));
    const method = (init?.method ?? "GET").toUpperCase();

    if (url.includes("/api/orders/list")) return handlers.list();
    if (url.includes("/api/users/me")) return handlers.me();
    if (url.includes("/api/customers/lookup")) return handlers.lookup();
    if (url.includes("/api/orders/check-duplicate")) {
      events.push("check-duplicate");
      return handlers.checkDuplicate(url);
    }
    if (url.includes("/api/orders") && method === "POST") {
      events.push("POST");
      return handlers.postOrders();
    }
    return jsonResponse({});
  });

  mockShowToast.mockReset();
  mockShowToast.mockImplementation((type: string) => {
    events.push(`toast:${type}`);
  });

  openSpy = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("open", openSpy);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

// --- helpers --------------------------------------------------------------
const user = userEvent.setup({ pointerEventsCheck: 0 });

/** Count POST calls to /api/orders (excludes check-duplicate / list). */
function postOrderCalls(): unknown[] {
  return fetchMock.mock.calls.filter((c) => {
    const url = typeof c[0] === "string" ? c[0] : String(c[0]);
    const method = (c[1]?.method ?? "GET").toUpperCase();
    return (
      url.includes("/api/orders") &&
      !url.includes("/api/orders/check-duplicate") &&
      !url.includes("/api/orders/list") &&
      method === "POST"
    );
  });
}

function checkDuplicateCalls(): unknown[] {
  return fetchMock.mock.calls.filter((c) => {
    const url = typeof c[0] === "string" ? c[0] : String(c[0]);
    return url.includes("/api/orders/check-duplicate");
  });
}

/** Render the page and wait for the initial UI (the always-present add button). */
async function renderPage() {
  render(<AdminPage />);
  // The header "Tambah Pesanan" button is present on first render; awaiting it
  // confirms the page mounted without depending on async mount effects.
  await screen.findAllByRole("button", { name: /tambah pesanan/i });
}

/** Open the create-order modal via the header "Tambah Pesanan" button. */
async function openCreateModal() {
  const addButtons = screen.getAllByRole("button", {
    name: /tambah pesanan/i,
  });
  await user.click(addButtons[0]);
  // Wait for the form to render inside the modal.
  await screen.findByLabelText(/nomor hp/i);
}

/** Set a HeroUI text input/textarea value reliably in a controlled tree. */
function setField(matcher: RegExp, value: string) {
  const el = screen.getByLabelText(matcher) as
    | HTMLInputElement
    | HTMLTextAreaElement;
  fireEvent.change(el, { target: { value } });
}

/**
 * Fill the create form: valid name + phone, optionally selecting activity
 * types. `types` uses the checkbox labels "Jemput" / "Antar".
 */
async function fillForm({
  nama = "Budi",
  phone = "08123456789",
  types = ["Antar", "Jemput"] as Array<"Antar" | "Jemput">,
}: {
  nama?: string;
  phone?: string;
  types?: Array<"Antar" | "Jemput">;
} = {}) {
  setField(/nama pelanggan/i, nama);
  setField(/nomor hp/i, phone);
  setField(/alamat lengkap/i, "Jl. Merdeka 45");

  for (const t of types) {
    const cb = screen.getByRole("checkbox", { name: t });
    await user.click(cb);
  }
}

async function clickSave() {
  const saveBtn = screen.getByRole("button", { name: /simpan pesanan/i });
  await user.click(saveBtn);
}

// --- fixtures -------------------------------------------------------------
const validAntar: TicketWaData = {
  nomor_tiket: "A BUD 1234",
  jenis_tugas: "ANTAR",
  alamat_jalan: "Jl. Merdeka 45",
  waktu_penjemputan: "2025-01-01T10:00:00.000Z",
  nama: "Budi",
  nomor_hp: "628123456789",
  catatan_khusus: "Antar sore",
};

const validJemput: TicketWaData = {
  nomor_tiket: "J BUD 5678",
  jenis_tugas: "JEMPUT",
  alamat_jalan: "Jl. Merdeka 45",
  waktu_penjemputan: "2025-01-02T09:30:00.000Z",
  nama: "Budi",
  nomor_hp: "628123456789",
  catatan_khusus: "Jemput pagi",
};

describe("AdminPage success state + submit flow", () => {
  // Req 1.1, 1.9: one WA button per created ticket; clicking opens the built URL.
  it("lists one WA button per created ticket and opens the built URL on click", async () => {
    handlers.postOrders = () =>
      jsonResponse({
        success: true,
        orders: [validAntar, validJemput],
        warnings: [],
      });

    await renderPage();
    await openCreateModal();
    await fillForm({ types: ["Antar", "Jemput"] });
    await clickSave();

    const waButtons = await screen.findAllByRole("button", {
      name: /kirim wa/i,
    });
    expect(waButtons).toHaveLength(2);

    const antarBtn = screen.getByRole("button", {
      name: /kirim wa \(antar\)/i,
    });
    await user.click(antarBtn);

    const expectedUrl = buildWaUrl(
      validAntar.nomor_hp,
      buildTicketWaMessage(validAntar),
    );
    expect(expectedUrl).not.toBeNull();
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith(expectedUrl, "_blank");
  });

  // Req 1.11, 1.12: invalid-phone ticket shows error chip, no WA button, and an
  // immediate error toast surfaced on save.
  it("shows the invalid-contact chip and no WA button for an invalid phone", async () => {
    const invalidTicket: TicketWaData = {
      ...validAntar,
      nomor_hp: "123", // < 7 digits -> buildWaUrl returns null
    };

    handlers.postOrders = () =>
      jsonResponse({ success: true, orders: [invalidTicket], warnings: [] });

    await renderPage();
    await openCreateModal();
    await fillForm({ types: ["Antar"] });
    await clickSave();

    await screen.findByText(/Nomor HP tidak valid, WA tidak dapat dikirim/i);
    expect(
      screen.queryByRole("button", { name: /kirim wa/i }),
    ).not.toBeInTheDocument();

    // Req 1.12: invalid-contact surfaced immediately as an error toast.
    expect(mockShowToast).toHaveBeenCalledWith("error", expect.any(String));
  });

  // Req 1.10: closing the success state fires no extra ticket calls and the
  // success view is removed.
  it("closing the success state fires no extra ticket calls and clears the view", async () => {
    handlers.postOrders = () =>
      jsonResponse({ success: true, orders: [validAntar], warnings: [] });

    await renderPage();
    await openCreateModal();
    await fillForm({ types: ["Antar"] });
    await clickSave();

    await screen.findByRole("button", { name: /kirim wa/i });

    // Reset history, then close.
    fetchMock.mockClear();
    const tutup = screen.getByRole("button", { name: /tutup/i });
    await user.click(tutup);

    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /kirim wa/i }),
      ).not.toBeInTheDocument(),
    );

    // No new ticket-related network calls were made by closing.
    expect(postOrderCalls()).toHaveLength(0);
    expect(checkDuplicateCalls()).toHaveLength(0);
  });

  // Req 3.7, 4.3: declining the duplicate confirm fires no POST for that type
  // and leaves the form unchanged.
  it("declining the duplicate confirm fires no POST and keeps the form", async () => {
    handlers.checkDuplicate = () =>
      jsonResponse({
        exists: true,
        nama: "Budi",
        nomor_hp_local: "08123456789",
        jenis: "JEMPUT",
      });

    await renderPage();
    await openCreateModal();
    await fillForm({ nama: "Budi", types: ["Jemput"] });
    await clickSave();

    // Blocking confirm appears; decline it.
    const tidak = await screen.findByRole("button", { name: /^tidak$/i });
    await user.click(tidak);

    await waitFor(() =>
      expect(
        screen.queryByText(/Tiket duplikat ditemukan/i),
      ).not.toBeInTheDocument(),
    );

    // No POST was issued for the declined type.
    expect(postOrderCalls()).toHaveLength(0);

    // The form is still showing with the entered name intact (not mutated).
    expect(screen.getByDisplayValue("Budi")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /kirim wa/i }),
    ).not.toBeInTheDocument();
  });

  // Req 4.1, 4.2: ticket confirmation resolves BEFORE POST; nota warning is
  // toasted AFTER save (never overlapping).
  it("resolves the ticket confirmation before POST and toasts the nota warning after save", async () => {
    handlers.checkDuplicate = () =>
      jsonResponse({
        exists: true,
        nama: "Budi",
        nomor_hp_local: "08123456789",
        jenis: "ANTAR",
      });
    handlers.postOrders = () =>
      jsonResponse({
        success: true,
        orders: [validAntar],
        warnings: [
          {
            type: "duplicate_nota",
            jenis_tugas: "ANTAR",
            nomor_nota: "INV-001",
          },
        ],
      });

    await renderPage();
    await openCreateModal();
    await fillForm({ types: ["Antar"] });
    await clickSave();

    // Confirm modal appears. At this point the POST must NOT have been issued.
    const ya = await screen.findByRole("button", { name: /^ya$/i });
    expect(events).toContain("check-duplicate");
    expect(events).not.toContain("POST");

    // Confirm -> save proceeds.
    await user.click(ya);

    // The nota warning is toasted; wait for it.
    await waitFor(() => expect(events).toContain("toast:warning"));

    const iCheck = events.indexOf("check-duplicate");
    const iPost = events.indexOf("POST");
    const iWarn = events.indexOf("toast:warning");

    // check-duplicate (and confirm) happen before POST (Req 4.1/4.2 ordering).
    expect(iCheck).toBeGreaterThanOrEqual(0);
    expect(iPost).toBeGreaterThan(iCheck);
    // Nota warning is toasted only after the save resolved (never overlapping).
    expect(iWarn).toBeGreaterThan(iPost);

    expect(mockShowToast).toHaveBeenCalledWith(
      "warning",
      expect.stringContaining("INV-001"),
    );
  });
});
