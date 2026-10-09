import { render, screen } from "@testing-library/react";

import { niceTicks } from "@/sudo/dashboard/pages/AnalyticsPage";

import { spanStart, TraceHero } from "./hero/TraceHero";

describe("TraceHero", () => {
  it("spreads span starts across the first 80% of the track", () => {
    expect([0, 1, 2, 3, 4].map((i) => spanStart(i, 5))).toEqual([0, 20, 40, 60, 80]);
    expect(spanStart(0, 1)).toBe(0);
  });

  it("renders one lane per stage and marks the last as the current focus", () => {
    render(<TraceHero stages={["Apps", "Backend", "AI systems"]} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByLabelText("AI systems (current focus)")).toBeInTheDocument();
    expect(screen.getByText(/Career trace, oldest to newest/)).toBeInTheDocument();
  });

  it("renders nothing without stages", () => {
    const { container } = render(<TraceHero stages={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("niceTicks", () => {
  it("produces clean axis values covering the max", () => {
    expect(niceTicks(31)).toEqual([0, 10, 20, 30, 40]);
    expect(niceTicks(3)).toEqual([0, 1, 2, 3]);
    expect(niceTicks(0).length).toBeGreaterThan(1);
  });
});
