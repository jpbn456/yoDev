// Pure business logic for yoDev profile utilities.
// Kept framework-agnostic so it can be unit-tested without React/DOM.

export const proficiencyOptions = [
  { value: "A1", label: "A1 · Principiante" },
  { value: "A2", label: "A2 · Básico" },
  { value: "B1", label: "B1 · Intermedio" },
  { value: "B2", label: "B2 · Intermedio alto" },
  { value: "C1", label: "C1 · Avanzado" },
  { value: "C2", label: "C2 · Dominio pleno" },
  { value: "Nativo", label: "Nativo" },
];

// Keep legacy text selectable without guessing its CEFR equivalence.
export function optionsWithLegacy(options, value, placeholder) {
  return [
    { value: "", label: placeholder },
    ...options,
    ...(value && !options.some((option) => option.value === value)
      ? [{ value, label: `${value} (guardado)` }]
      : []),
  ];
}

export function normalizeLanguages(languages = []) {
  return languages.map((item) => typeof item === "string"
    ? { language: item, proficiency: "" }
    : { ...item, language: item.language || "", proficiency: item.proficiency || "" });
}

export function formatEducationPeriod({ start, end, current }) {
  return [start, current === true ? "En curso" : end].filter(Boolean).join(" — ");
}

/**
 * Calculate total years of professional experience from a list of
 * experience entries. Each entry has optional { start, end, current }.
 * `start`/`end` are "YYYY-MM" strings. When `current` is true (or `end`
 * is missing), the range extends to today.
 *
 * @param {Array<{company?: string, role?: string, start?: string, end?: string, current?: boolean}>} experiences
 * @returns {number} floor of years between earliest start and latest end (0 if insufficient data)
 */
export function calculateYears(experiences) {
  if (!experiences || !experiences.length) return 0;
  const parse = (value) => {
    if (!value) return null;
    const [y, m] = value.split("-").map(Number);
    if (!y || Number.isNaN(y)) return null;
    return new Date(y, (m && !Number.isNaN(m) ? m : 1) - 1);
  };
  let earliest = null;
  let latest = null;
  for (const exp of experiences) {
    const start = parse(exp.start);
    if (start && (!earliest || start < earliest)) earliest = start;
    let end;
    if (exp.current || !exp.end) end = new Date();
    else end = parse(exp.end);
    if (end && (!latest || end > latest)) latest = end;
  }
  if (!earliest || !latest || latest < earliest) return 0;
  return Math.max(0, Math.floor((latest - earliest) / (365.25 * 24 * 60 * 60 * 1000)));
}

/**
 * Normalize a work-mode value into its human label, or fall back to the
 * raw value if not recognized. Used to normalize directory responses.
 */
export function workModeLabel(workModes, value) {
  if (Array.isArray(workModes)) {
    const found = workModes.find((mode) => mode.value === value);
    if (found) return found.label;
  }
  return value;
}

/**
 * Parse comma-separated tag text into a trimmed list of non-empty tags.
 * Use this only when committing finished input (blur/submit), NOT on every
 * keystroke: parsing mid-typing makes a trailing comma disappear, so the
 * user can never separate values.
 */
export function parseTags(text) {
  return (text || "").split(",").map((tag) => tag.trim()).filter(Boolean);
}

/**
 * Toggle a value in an array (add if absent, remove if present).
 */
export function toggleValue(values, value) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function normalizeSkillNames(skills = []) {
  return skills.map((skill) => typeof skill === "string" ? skill : skill?.name).filter(Boolean);
}

export function skillsForCard(profile) {
  const skills = Array.isArray(profile.highlightedSkills) ? profile.highlightedSkills : profile.skills || [];
  return skills.slice(0, 4);
}

/**
 * Filter demo/fallback profiles against the active filters.
 * Mirrors the backend filtering contract.
 *
 * @param {Array} profiles
 * @param {{required: string[], optional: string[], languages: string[], country: string, region: string, city: string, workModes: string[], minYears: number}} filters
 * @param {Array<{value: string, label: string}>} workModes
 * @returns {Array} matching profiles sorted by relevance or last name
 */
export function filterProfiles(profiles, filters, workModes) {
  const slugify = (skill) => String(skill).toLowerCase().replaceAll(" ", "-");
  const matches = profiles.filter((profile) => {
    const availableSkills = (profile.skills || []).map(slugify);
    const requiredMatch = filters.required.every((skill) => availableSkills.includes(skill));
    const locationMatch = [
      ["country", profile.country],
      ["region", profile.region],
      ["city", profile.city],
    ].every(([key, value]) => !filters[key] || value?.toLowerCase() === filters[key].toLowerCase());
    const modeLabels = (profile.workModes || []).map((item) => item.toLowerCase());
    const modesMatch =
      !filters.workModes.length ||
      filters.workModes.some((mode) => modeLabels.includes(workModeLabel(workModes, mode).toLowerCase()));
    const availableLanguages = (profile.languages || []).map((item) =>
      (typeof item === "string" ? item : item.language).toLowerCase()
    );
    const languagesMatch = filters.languages.every((language) =>
      availableLanguages.includes(language.toLowerCase())
    );
    const yearsMatch = !filters.minYears || calculateYears(profile.experiences) >= filters.minYears;
    return requiredMatch && locationMatch && modesMatch && languagesMatch && yearsMatch;
  });
  return matches.sort((first, second) => {
    if (filters.sort === "relevance") {
      const score = (profile) =>
        filters.optional.filter((skill) =>
          (profile.skills || []).map(slugify).includes(skill)
        ).length;
      return score(second) - score(first) || first.lastName.localeCompare(second.lastName);
    }
    return first.lastName.localeCompare(second.lastName);
  });
}
