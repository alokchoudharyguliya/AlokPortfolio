/**
 * Owner-session behaviour of the Terminal: the commands must hit exactly the
 * same admin endpoints the dashboard uses, validate input before sending, and
 * never fire a request when a precondition fails.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { api } from "@/api/client";
import { PreferencesProvider } from "@/lib/preferences/PreferencesProvider";
import { isModeAvailable } from "@/modes/registry";
import { SudoProvider } from "@/sudo/SudoProvider";
import { ToastProvider } from "@/ui/Toast";

import { makeBootstrap } from "./fixtures";
import TerminalLayout from "./TerminalLayout";

vi.mock("@/api/auth", () => ({
  useMe: () => ({ data: { authenticated: true, user: { id: 1, username: "alok" } } }),
  useLogout: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/client")>()),
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() },
}));

const bootstrap = makeBootstrap({ drafts: true });

function renderOwner() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <PreferencesProvider isModeAvailable={isModeAvailable}>
          <ToastProvider>
            <SudoProvider>
              <Routes>
                <Route path="/*" element={<TerminalLayout bootstrap={bootstrap}>{null}</TerminalLayout>} />
              </Routes>
            </SudoProvider>
          </ToastProvider>
        </PreferencesProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// By id: the shared editor drawer (opened by `edit`) adds more textboxes to the page.
const input = () => document.getElementById("terminal-input") as HTMLInputElement;
const type = (line: string) => {
  fireEvent.change(input(), { target: { value: line } });
  fireEvent.submit(input().closest("form")!);
};

describe("Terminal owner commands", () => {
  beforeAll(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  });
  beforeEach(() => {
    vi.mocked(api.patch).mockReset().mockResolvedValue({});
    vi.mocked(api.post).mockReset().mockResolvedValue({});
    vi.mocked(api.get).mockReset().mockResolvedValue({});
    // The owner bar polls; keep unrelated requests quiet.
  });

  it("shows a root prompt and owner help", async () => {
    renderOwner();
    expect(screen.getByTitle("root@alok:~#")).toBeInTheDocument();
    type("help");
    expect(await screen.findByText("edit <path|profile|site>")).toBeInTheDocument();
  });

  it("`set` PATCHes the item endpoint with a coerced value", async () => {
    renderOwner();
    type('set projects/inference-lab summary "A sharper summary"');
    expect(await screen.findByText(/inference-lab\.summary updated/)).toBeInTheDocument();
    expect(api.patch).toHaveBeenCalledWith("/admin/projects/10/", { summary: "A sharper summary" });
  });

  it("`set` on a singleton uses the singleton endpoint", async () => {
    renderOwner();
    type('set profile headline "Systems engineer"');
    expect(await screen.findByText(/profile\.headline updated/)).toBeInTheDocument();
    expect(api.patch).toHaveBeenCalledWith("/admin/profile/", { headline: "Systems engineer" });
  });

  it("`set` validates before sending anything", async () => {
    renderOwner();
    type("set projects/inference-lab status done");
    expect(await screen.findByText(/must be one of/)).toBeInTheDocument();
    type("set projects/inference-lab nope x");
    expect(await screen.findByText(/has no field "nope"/)).toBeInTheDocument();
    type("set projects status x");
    expect(await screen.findByText(/is a collection/)).toBeInTheDocument();
    type("set projects/inference-lab cover x");
    expect(await screen.findByText(/Use `edit`/)).toBeInTheDocument();
    expect(api.patch).not.toHaveBeenCalled();
  });

  it("`set` surfaces API validation errors", async () => {
    const { ApiError } = await import("@/api/client");
    vi.mocked(api.patch).mockRejectedValueOnce(new ApiError(400, { message: "Please correct the errors below.", fields: { title: ["Too long."] } }));
    renderOwner();
    type("set projects/inference-lab title x");
    expect(await screen.findByText(/title: Too long\./)).toBeInTheDocument();
  });

  it("`hide` and `publish` toggle is_published, skipping no-ops", async () => {
    renderOwner();
    type("publish projects/inference-lab");
    expect(await screen.findByText(/already published/)).toBeInTheDocument();
    expect(api.patch).not.toHaveBeenCalled();

    type("hide projects/inference-lab");
    expect(await screen.findByText(/now hidden/)).toBeInTheDocument();
    expect(api.patch).toHaveBeenLastCalledWith("/admin/projects/10/", { is_published: false });

    type("publish projects/secret-draft");
    expect(await screen.findByText(/visible to visitors/)).toBeInTheDocument();
    expect(api.patch).toHaveBeenLastCalledWith("/admin/projects/11/", { is_published: true });
  });

  it("`hide` refuses things that cannot be published", async () => {
    renderOwner();
    type("hide about");
    expect(await screen.findByText(/no published\/hidden state/)).toBeInTheDocument();
    expect(api.patch).not.toHaveBeenCalled();
  });

  it("`edit` and `new` open the shared editor", async () => {
    renderOwner();
    type("edit projects/inference-lab");
    expect(await screen.findByText(/Opening the editor for ~\/projects\/inference-lab/)).toBeInTheDocument();
    type("new projects");
    expect(await screen.findByText(/Opening a blank project/)).toBeInTheDocument();
    type("edit projects");
    expect(await screen.findByText(/is a collection/)).toBeInTheDocument();
  });

  it("`history <path>` lists versions and `restore` asks before acting", async () => {
    vi.mocked(api.get).mockResolvedValue({
      count: 1,
      results: [{ id: 5, resource: "projects.project", object_id: "10", object_repr: "x", action: "update", user: "alok", created_at: new Date().toISOString() }],
    });
    renderOwner();
    type("history projects/inference-lab");
    expect(await screen.findByText("#5")).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("/admin/versions/", { resource: "projects.project", object_id: 10, page_size: 8 });

    type("restore 5");
    expect(await screen.findByText(/This replaces the current content/)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();

    type("restore 5 --yes");
    expect(await screen.findByText("Restored version #5.")).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith("/admin/versions/5/restore/");
  });

  it("plain `history` still lists typed commands", async () => {
    renderOwner();
    type("pwd");
    type("history");
    const out = await screen.findByRole("log");
    expect(within(out).getAllByRole("button", { name: "pwd" }).length).toBeGreaterThan(0);
  });
});
