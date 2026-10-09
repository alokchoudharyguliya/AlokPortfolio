import { RESOURCES } from "@/domain/resources";

import { initialValues, toPayload } from "./ResourceForm";

const projects = RESOURCES.projects;

describe("ResourceForm value conversion", () => {
  it("fills empty values by field type and applies defaults", () => {
    const values = initialValues(projects, null);
    expect(values.title).toBe("");
    expect(values.tags).toEqual([]);
    expect(values.cover).toBeNull();
    expect(values.is_featured).toBe(false);
    expect(values.category).toBe("other");
  });

  it("converts UI values back to the API shape", () => {
    const values = {
      ...initialValues(projects, null),
      title: "T",
      cover: { id: 7, url: "/m.png", alt: "", kind: "image", width: 1, height: 1 },
      gallery: [{ id: 3 }, { id: 4 }],
      highlights: ["  a  ", "", "b"],
      metrics: [{ label: "p95", value: "-38%" }, { label: " ", value: "x" }],
      start_date: "",
    };
    const payload = toPayload(projects, values);
    expect(payload.cover).toBe(7);
    expect(payload.gallery).toEqual([3, 4]);
    expect(payload.highlights).toEqual(["a", "b"]);
    expect(payload.metrics).toEqual([{ label: "p95", value: "-38%" }]);
    expect(payload.start_date).toBeNull();
  });

  it("sends only changed fields when editing", () => {
    const payload = toPayload(projects, initialValues(projects, { title: "New" }), new Set(["title"]));
    expect(payload).toEqual({ title: "New" });
  });

  it("relations round-trip as numbers", () => {
    const skills = RESOURCES.skills;
    const values = initialValues(skills, { name: "CUDA", category: 4 });
    expect(values.category).toBe("4"); // <select> works with strings
    expect(toPayload(skills, values, new Set(["category"]))).toEqual({ category: 4 });
  });
});
