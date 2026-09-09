import { describe, it, expect } from "vitest";
import {
  calculateYears,
  workModeLabel,
  toggleValue,
  filterProfiles,
  proficiencyOptions,
  optionsWithLegacy,
  normalizeLanguages,
  formatEducationPeriod,
  parseTags,
} from "./profileUtils.js";

describe("parseTags", () => {
  it("splits comma-separated text into trimmed non-empty tags", () => {
    expect(parseTags("Python, Django, SQL")).toEqual(["Python", "Django", "SQL"]);
  });

  it("does not choke on a trailing comma while typing", () => {
    expect(parseTags("Python,")).toEqual(["Python"]);
    expect(parseTags("Python, ")).toEqual(["Python"]);
  });

  it("ignores empty chunks and whitespace-only input", () => {
    expect(parseTags(", ,")).toEqual([]);
    expect(parseTags("   ")).toEqual([]);
    expect(parseTags("")).toEqual([]);
    expect(parseTags(undefined)).toEqual([]);
  });

  it("trims surrounding whitespace from each tag", () => {
    expect(parseTags("  React  ,  Node.js ,TypeScript  ")).toEqual(["React", "Node.js", "TypeScript"]);
  });
});

describe("education periods", () => {
  it("labels only explicitly current education as ongoing", () => {
    expect(formatEducationPeriod({ start: "2024-03", end: "2025-12", current: true })).toBe("2024-03 — En curso");
    expect(formatEducationPeriod({ current: true })).toBe("En curso");
    expect(formatEducationPeriod({ start: "2020-03", end: "2023-12" })).toBe("2020-03 — 2023-12");
    expect(formatEducationPeriod({ start: "2020-03", end: "" })).toBe("2020-03");
    expect(formatEducationPeriod({ start: "2020-03", current: false })).toBe("2020-03");
    expect(formatEducationPeriod({})).toBe("");
  });
});

describe("language editor compatibility", () => {
  it("offers CEFR A1–C2 and native without guessing legacy equivalences", () => {
    expect(proficiencyOptions.map(({ value }) => value)).toEqual(["A1", "A2", "B1", "B2", "C1", "C2", "Nativo"]);
    const options = optionsWithLegacy(proficiencyOptions, "Conversacional", "Select level");
    expect(options.at(-1)).toEqual({ value: "Conversacional", label: "Conversacional (guardado)" });
    expect(optionsWithLegacy(proficiencyOptions, "B2", "Select level").filter(({ value }) => value === "B2")).toHaveLength(1);
  });

  it("preserves string languages and exact legacy proficiency without mutating saved data", () => {
    const original = ["Inglés", { language: "Guaraní", proficiency: "Competencia profesional" }];
    expect(normalizeLanguages(original)).toEqual([
      { language: "Inglés", proficiency: "" },
      { language: "Guaraní", proficiency: "Competencia profesional" },
    ]);
    expect(original[0]).toBe("Inglés");
    expect(normalizeLanguages()).toEqual([]);
  });
});

const workModes = [
  { value: "remote", label: "Remoto" },
  { value: "hybrid", label: "Híbrido" },
  { value: "onsite", label: "In-site" },
];

describe("calculateYears", () => {
  it("returns 0 for empty or missing input", () => {
    expect(calculateYears([])).toBe(0);
    expect(calculateYears(null)).toBe(0);
    expect(calculateYears(undefined)).toBe(0);
  });

  it("computes full years between start and end", () => {
    const years = calculateYears([
      { company: "A", role: "Dev", start: "2018-01", end: "2021-01" },
    ]);
    expect(years).toBe(3);
  });

  it("uses today as endpoint when current is true", () => {
    const now = new Date();
    const startYear = now.getFullYear() - 5;
    const years = calculateYears([
      { company: "A", role: "Dev", start: `${startYear}-06`, current: true },
    ]);
    // Somewhere around 5, but must be >= 0 and plausible
    expect(years).toBeGreaterThanOrEqual(4);
    expect(years).toBeLessThanOrEqual(6);
  });

  it("treats missing end as current (open-ended)", () => {
    const now = new Date();
    const start = `${now.getFullYear() - 2}-01`;
    const years = calculateYears([{ company: "A", role: "Dev", start }]);
    expect(years).toBeGreaterThanOrEqual(1);
    expect(years).toBeLessThanOrEqual(3);
  });

  it("uses the earliest start and latest end across entries", () => {
    const years = calculateYears([
      { company: "A", role: "Junior", start: "2015-03", end: "2018-03" },
      { company: "B", role: "Senior", start: "2018-03", end: "2021-03" },
    ]);
    expect(years).toBe(6);
  });

  it("returns 0 when end is before start", () => {
    const years = calculateYears([
      { company: "A", role: "Dev", start: "2021-01", end: "2019-01" },
    ]);
    expect(years).toBe(0);
  });
});

describe("workModeLabel", () => {
  it("returns matching label for a valid value", () => {
    expect(workModeLabel(workModes, "remote")).toBe("Remoto");
    expect(workModeLabel(workModes, "hybrid")).toBe("Híbrido");
    expect(workModeLabel(workModes, "onsite")).toBe("In-site");
  });

  it("falls back to the raw value for unknown modes", () => {
    expect(workModeLabel(workModes, "on-site")).toBe("on-site");
  });
});

describe("toggleValue", () => {
  it("adds a value when absent", () => {
    expect(toggleValue(["a"], "b")).toEqual(["a", "b"]);
  });

  it("removes a value when present", () => {
    expect(toggleValue(["a", "b"], "a")).toEqual(["b"]);
  });

  it("does not mutate the original array", () => {
    const original = ["a"];
    toggleValue(original, "b");
    expect(original).toEqual(["a"]);
  });
});

const sampleProfiles = [
  {
    id: "1",
    slug: "backend",
    firstName: "Lucas",
    lastName: "Pérez",
    country: "Argentina",
    region: "Buenos Aires",
    city: "CABA",
    skills: ["Python", "Django", "PostgreSQL"],
    workModes: ["Remoto"],
    languages: [{ language: "Español", proficiency: "Nativo" }],
    experiences: [
      { company: "X", role: "Dev", start: "2019-01", current: true },
    ],
  },
  {
    id: "2",
    slug: "frontend",
    firstName: "Ana",
    lastName: "Díaz",
    country: "Uruguay",
    region: "Montevideo",
    city: "Montevideo",
    skills: ["React", "TypeScript"],
    workModes: ["Híbrido"],
    languages: [{ language: "Inglés", proficiency: "Avanzado" }],
    experiences: [
      { company: "Y", role: "FE", start: "2024-06", current: true },
    ],
  },
];

describe("filterProfiles", () => {
  const emptyFilters = {
    required: [],
    optional: [],
    languages: [],
    country: "",
    region: "",
    city: "",
    workModes: [],
    minYears: 0,
    sort: "last_name",
  };

  it("returns all profiles with empty filters (sorted by last name)", () => {
    const result = filterProfiles(sampleProfiles, emptyFilters, workModes);
    // Díaz sorts before Pérez
    expect(result.map((p) => p.id)).toEqual(["2", "1"]);
  });

  it("filters by a required skill (slug-matched)", () => {
    const result = filterProfiles(
      sampleProfiles,
      { ...emptyFilters, required: ["python"] },
      workModes,
    );
    expect(result.map((p) => p.id)).toEqual(["1"]);
  });

  it("filters by location", () => {
    const result = filterProfiles(
      sampleProfiles,
      { ...emptyFilters, country: "Uruguay" },
      workModes,
    );
    expect(result.map((p) => p.id)).toEqual(["2"]);
  });

  it("filters by work mode via label", () => {
    const result = filterProfiles(
      sampleProfiles,
      { ...emptyFilters, workModes: ["remote"] },
      workModes,
    );
    expect(result.map((p) => p.id)).toEqual(["1"]);
  });

  it("filters by language", () => {
    const result = filterProfiles(
      sampleProfiles,
      { ...emptyFilters, languages: ["inglés"] },
      workModes,
    );
    expect(result.map((p) => p.id)).toEqual(["2"]);
  });

  it("filters by minimum years of experience", () => {
    // Profile 1 started 2019 (7+ yrs as of 2026), profile 2 started 2024 (2+ yrs)
    const result = filterProfiles(
      sampleProfiles,
      { ...emptyFilters, minYears: 3 },
      workModes,
    );
    expect(result.map((p) => p.id)).toEqual(["1"]);
  });

  it("sorts by last name by default", () => {
    const result = filterProfiles(sampleProfiles, emptyFilters, workModes);
    expect(result[0].lastName).toBe("Díaz");
    expect(result[1].lastName).toBe("Pérez");
  });

  it("sorts by relevance when optional skills match", () => {
    const result = filterProfiles(
      sampleProfiles,
      { ...emptyFilters, sort: "relevance", optional: ["react", "typescript"] },
      workModes,
    );
    expect(result[0].id).toBe("2");
  });
});
