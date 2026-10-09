import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";

import { PreferencesProvider } from "@/lib/preferences/PreferencesProvider";
import { isModeAvailable } from "@/modes/registry";

import { makeBootstrap } from "./fixtures";
import TerminalLayout from "./TerminalLayout";
import { ProjectView } from "./views";

// The shell reads the owner session; tests run as an anonymous visitor.
vi.mock("@/api/auth", () => ({
  useMe: () => ({ data: { authenticated: false, user: null } }),
  useLogout: () => ({ mutateAsync: vi.fn() }),
}));

const bootstrap = makeBootstrap({
  // The API never returns drafts to visitors, so the public fixture drops them.
  projects: makeBootstrap().projects.filter((p) => p.is_published),
});

function renderTerminal(initialPath = "/", children: ReactNode = null) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialPath]}>
        <PreferencesProvider isModeAvailable={isModeAvailable}>
          <Routes>
            <Route path="/*" element={<TerminalLayout bootstrap={bootstrap}>{children}</TerminalLayout>} />
          </Routes>
        </PreferencesProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// The only textbox; its accessible name changes while a multi-step prompt is active.
const input = () => screen.getByRole("textbox") as HTMLInputElement;
const transcript = () => screen.getByRole("log");

function type(line: string) {
  fireEvent.change(input(), { target: { value: line } });
  fireEvent.submit(input().closest("form")!);
}

describe("Terminal mode", () => {
  beforeAll(() => {
    // jsdom has no canvas; the mode switcher probes WebGL support.
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  });

  it("greets the visitor and shows a guest prompt", () => {
    renderTerminal();
    expect(within(transcript()).getByText("Alok Choudhary")).toBeInTheDocument();
    expect(screen.getAllByText(/guest@alok/).length).toBeGreaterThan(0);
    expect(screen.getByRole("navigation", { name: "Suggested commands" })).toBeInTheDocument();
  });

  it("lists directories and files with `ls`", async () => {
    renderTerminal();
    type("ls");
    const out = transcript();
    expect(await within(out).findByRole("button", { name: "projects/" })).toBeInTheDocument();
    expect(within(out).getByRole("button", { name: "links/" })).toBeInTheDocument();
    // Files are listed without a slash (the welcome banner also offers "about", so match all).
    expect(within(out).getAllByRole("button", { name: "about" }).length).toBeGreaterThan(1);
  });

  it("reads a file with `cat` and echoes the command", async () => {
    renderTerminal();
    type("cat about");
    expect(await screen.findByText("I like what happens beneath an abstraction.")).toBeInTheDocument();
    expect(within(transcript()).getByText("cat about")).toBeInTheDocument();
  });

  it("treats a section name as a shortcut for cat and lists its items", async () => {
    renderTerminal();
    type("projects");
    expect(await within(transcript()).findByRole("button", { name: "inference-lab" })).toBeInTheDocument();
    // Unpublished items are not visible to visitors.
    expect(within(transcript()).queryByText("secret-draft")).not.toBeInTheDocument();
  });

  it("makes output tappable: clicking a name runs cat for it", async () => {
    renderTerminal();
    type("projects");
    fireEvent.click(await within(transcript()).findByRole("button", { name: "inference-lab" }));
    expect(await screen.findByText("Optimising model artifacts")).toBeInTheDocument();
  });

  it("changes directory and reflects it in the prompt", async () => {
    renderTerminal();
    // The title bar shows the live prompt.
    expect(screen.getByTitle("guest@alok:~$")).toBeInTheDocument();
    type("cd projects");
    expect(await screen.findByTitle("guest@alok:~/projects$")).toBeInTheDocument();
    type("cd ..");
    expect(await screen.findByTitle("guest@alok:~$")).toBeInTheDocument();
    type("cd nowhere");
    expect(await screen.findByText(/no such file or directory: nowhere/)).toBeInTheDocument();
  });

  it("suggests a correction for unknown commands and paths", async () => {
    renderTerminal();
    type("lss");
    expect(await screen.findByText(/lss: command not found/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ls" })).toBeInTheDocument();
    type("cat projects/inference-lb");
    expect(await screen.findByText(/no such file or directory/)).toBeInTheDocument();
  });

  it("refuses owner commands for visitors", async () => {
    renderTerminal();
    type("publish projects/inference-lab");
    expect(await screen.findByText(/permission denied/)).toBeInTheDocument();
  });

  it("completes with Tab and recalls history with the arrow keys", () => {
    renderTerminal();
    fireEvent.change(input(), { target: { value: "cat pro" } });
    fireEvent.keyDown(input(), { key: "Tab" });
    expect(input().value).toBe("cat projects/");

    type("pwd");
    expect(input().value).toBe("");
    fireEvent.keyDown(input(), { key: "ArrowUp" });
    expect(input().value).toBe("pwd");
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    expect(input().value).toBe("");
  });

  it("clears the screen with Ctrl+L", async () => {
    renderTerminal();
    type("pwd");
    expect(await within(transcript()).findByText("~", { selector: "code" })).toBeInTheDocument();
    fireEvent.keyDown(input(), { key: "l", ctrlKey: true });
    expect(within(transcript()).queryByText("Alok Choudhary")).not.toBeInTheDocument();
    expect(within(transcript()).queryByText("pwd")).not.toBeInTheDocument();
    expect(within(transcript()).queryByText("~", { selector: "code" })).not.toBeInTheDocument();
  });

  it("walks through the multi-step `message` prompt and can be cancelled", async () => {
    renderTerminal();
    type("message");
    expect(await screen.findByLabelText("Your name")).toBeInTheDocument();
    type("Ada");
    expect(await screen.findByLabelText("Your email")).toBeInTheDocument();
    fireEvent.keyDown(input(), { key: "c", ctrlKey: true });
    // Back to the normal prompt.
    expect(await screen.findByLabelText("Terminal command")).toBeInTheDocument();
  });

  it("runs the equivalent of `cat` for a deep-linked project URL", async () => {
    renderTerminal("/projects/inference-lab", (
      <Routes>
        <Route path="projects/:slug" element={<ProjectView bootstrap={bootstrap} slug="inference-lab" />} />
      </Routes>
    ));
    expect(await screen.findByText("Optimising model artifacts")).toBeInTheDocument();
    // Exactly once, even though effects can run twice in development.
    await act(async () => {});
    expect(screen.getAllByText("Optimising model artifacts")).toHaveLength(1);
  });
});
