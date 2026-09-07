import { useEffect, useId, useState } from "react";
import { createRoot } from "react-dom/client";
import { QRCodeSVG } from "qrcode.react";
import { fallbackSkills } from "./fallbackSkills.js";
import { calculateYears, workModeLabel, toggleValue, filterProfiles } from "./lib/profileUtils.js";
import "./styles.css";

const workModes = [
  { value: "remote", label: "Remoto" },
  { value: "hybrid", label: "Híbrido" },
  { value: "onsite", label: "In-site" },
];

const commonLanguages = [
  "Español",
  "Inglés",
  "Portugués",
  "Francés",
  "Alemán",
  "Italiano",
  "Japonés",
  "Chino mandarín",
  "Coreano",
  "Árabe",
  "Ruso",
];

const appearanceOptions = {
  palette: [
    { value: "ink", label: "Tinta" },
    { value: "ocean", label: "Océano" },
    { value: "orchid", label: "Orquídea" },
    { value: "moss", label: "Musgo" },
    { value: "sunset", label: "Atardecer" },
  ],
  font: [
    { value: "sans", label: "Sans editorial" },
    { value: "serif", label: "Serif contemporánea" },
    { value: "geometric", label: "Geométrica" },
  ],
  layout: [
    { value: "classic", label: "Clásico" },
    { value: "centered", label: "Centrado" },
    { value: "compact", label: "Compacto" },
  ],
  alignment: [
    { value: "left", label: "Izquierda" },
    { value: "center", label: "Centrada" },
  ],
};

const defaultStyle = {
  palette: "ink",
  font: "sans",
  layout: "classic",
  alignment: "left",
};

const blankProfile = {
  firstName: "",
  lastName: "",
  title: "Developer",
  introduction: "",
  email: "",
  linkedin: "",
  portfolio: "",
  country: "",
  region: "",
  city: "",
  visibleContacts: [],
  workModes: [],
  skills: [],
  experiences: [],
  languages: [],
  education: [],
  isPublished: false,
  style: defaultStyle,
};

const demoProfiles = [
  {
    id: "demo",
    slug: "demo",
    firstName: "yo",
    lastName: "Dev",
    title: "Backend Developer",
    introduction: "Perfil de demostración. Activá la API para publicar perfiles reales.",
    location: "Argentina",
    country: "Argentina",
    region: "Buenos Aires",
    city: "CABA",
    skills: ["Python", "Django", "PostgreSQL", "Docker"],
    workModes: ["Remoto"],
    contacts: { email: "hola@yodev.dev" },
    portfolio: "",
    experiences: [
      { company: "Feature Labs", role: "Backend Developer", start: "2021-03", current: true, description: "APIs REST y microservicios en Python.", technologies: ["Python", "Django", "PostgreSQL"] },
      { company: "Nubem", role: "Junior Developer", start: "2019-01", end: "2021-02", description: "Mantenimiento de backends Django.", technologies: ["Python", "Django"] },
    ],
    languages: [{ language: "Español", proficiency: "Nativo" }, { language: "Inglés", proficiency: "Avanzado" }],
    education: [{ institution: "UTN", degree: "Ingeniería en Sistemas", field: "Informática", start: "2014", end: "2020" }],
    style: defaultStyle,
    isFeatured: false,
  },
  {
    id: "demo-frontend",
    slug: "demo-frontend",
    firstName: "Valentina",
    lastName: "Ríos",
    title: "Frontend Engineer",
    introduction: "Diseño interfaces accesibles y de alto rendimiento con React y TypeScript.",
    location: "Uruguay",
    country: "Uruguay",
    region: "Montevideo",
    city: "Montevideo",
    skills: ["React", "TypeScript", "Next.js", "Tailwind CSS", "HTML"],
    workModes: ["Remoto", "Híbrido"],
    contacts: { linkedin: "https://linkedin.com/in/valentinaros" },
    portfolio: "https://valentina.dev",
    experiences: [
      { company: "Studio Norte", role: "Frontend Engineer", start: "2020-08", current: true, description: "Plataformas de e-commerce headless con Next.js.", technologies: ["React", "Next.js", "TypeScript"] },
      { company: "Agencia Loop", role: "UI Developer", start: "2018-03", end: "2020-07", description: "Landing pages y design systems.", technologies: ["React", "Tailwind CSS"] },
    ],
    languages: [{ language: "Español", proficiency: "Nativo" }, { language: "Portugués", proficiency: "Intermedio" }],
    education: [{ institution: "ORT", degree: "Licenciatura en Diseño", field: "Diseño Digital", start: "2013", end: "2018" }],
    style: { ...defaultStyle, palette: "orchid" },
    isFeatured: false,
  },
  {
    id: "demo-mobile",
    slug: "demo-mobile",
    firstName: "Martín",
    lastName: "Sosa",
    title: "Mobile Developer",
    introduction: "Aplicaciones nativas en Swift y Kotlin que se sienten rápidas y confiables.",
    location: "Argentina",
    country: "Argentina",
    region: "Córdoba",
    city: "Córdoba",
    skills: ["Swift", "Kotlin", "React Native", "Firebase"],
    workModes: ["Híbrido", "In-site"],
    contacts: { email: "msosa@mail.com", linkedin: "https://linkedin.com/in/martinsosa" },
    portfolio: "",
    experiences: [
      { company: "AppWorks", role: "Mobile Developer", start: "2019-06", current: true, description: "Apps iOS y Android para fintech.", technologies: ["Swift", "Kotlin"] },
    ],
    languages: [{ language: "Español", proficiency: "Nativo" }],
    education: [{ institution: "UNC", degree: "Ingeniería en Computación", field: "Informática", start: "2012", end: "2018" }],
    style: { ...defaultStyle, palette: "moss" },
    isFeatured: false,
  },
  {
    id: "demo-data",
    slug: "demo-data",
    firstName: "Camila",
    lastName: "Ferreyra",
    title: "Data Engineer",
    introduction: "Construyo pipelines de datos escalables en la nube con Python y Spark.",
    location: "Argentina",
    country: "Argentina",
    region: "Buenos Aires",
    city: "La Plata",
    skills: ["Python", "Apache Spark", "BigQuery", "Airflow", "SQL", "AWS"],
    workModes: ["Remoto"],
    contacts: { email: "cferreyra@data.io" },
    portfolio: "",
    experiences: [
      { company: "Datacorp", role: "Data Engineer", start: "2021-01", current: true, description: "ETL en la nube con Spark y Airflow.", technologies: ["Spark", "Airflow", "BigQuery"] },
      { company: "Telecom SRL", role: "Analista de datos", start: "2018-07", end: "2020-12", description: "Dashboards y SQL analytics.", technologies: ["SQL", "Looker"] },
    ],
    languages: [{ language: "Español", proficiency: "Nativo" }, { language: "Inglés", proficiency: "Avanzado" }],
    education: [{ institution: "UNLP", degree: "Lic. en Ciencia de Datos", field: "Datos", start: "2013", end: "2019" }],
    style: { ...defaultStyle, palette: "ocean" },
    isFeatured: false,
  },
  {
    id: "demo-devops",
    slug: "demo-devops",
    firstName: "Tomás",
    lastName: "Iglesias",
    title: "DevOps / SRE Engineer",
    introduction: "Automatizo infraestructura y hago que los deploy sean aburridos y predecibles.",
    location: "Chile",
    country: "Chile",
    region: "Santiago",
    city: "Santiago",
    skills: ["Docker", "Kubernetes", "Terraform", "CI/CD", "AWS", "Linux"],
    workModes: ["Remoto"],
    contacts: { linkedin: "https://linkedin.com/in/tomasiglesias" },
    portfolio: "",
    experiences: [
      { company: "CloudFirst", role: "DevOps Engineer", start: "2020-05", current: true, description: "Kubernetes y Terraform en AWS.", technologies: ["K8s", "Terraform", "AWS"] },
      { company: "MiPyME Tech", role: "SysAdmin", start: "2017-02", end: "2020-04", description: "Servidores Linux y monitoreo.", technologies: ["Linux", "Bash"] },
    ],
    languages: [{ language: "Español", proficiency: "Nativo" }, { language: "Inglés", proficiency: "Avanzado" }],
    education: [],
    style: { ...defaultStyle, palette: "sunset" },
    isFeatured: false,
  },
];

const modeLabel = (value) => workModeLabel(workModes, value);
const toggle = toggleValue;

function normalizeProfile(profile) {
  return {
    ...profile,
    style: { ...defaultStyle, ...profile.style },
    skills: (profile.skills || []).map((skill) => (typeof skill === "string" ? skill : skill.name)),
    workModes: (profile.workModes || []).map(modeLabel),
    contacts: profile.contacts || {},
    experiences: profile.experiences || [],
    languages: profile.languages || [],
    education: profile.education || [],
  };
}

function filterFallbackProfiles(filters) {
  const sorted = filterProfiles(demoProfiles, filters, workModes);
  // Owner-featured profiles are pinned first, mirrored from backend behavior.
  return sorted.sort((first, second) => {
    if (first.isFeatured !== second.isFeatured) return first.isFeatured ? -1 : 1;
    return 0;
  });
}

function getCsrfToken() {
  return document.cookie
    .split("; ")
    .find((item) => item.startsWith("csrftoken="))
    ?.split("=")[1];
}

async function api(path, options = {}) {
  const method = options.method || "GET";
  if (method !== "GET") {
    await fetch("/api/csrf/", { credentials: "include" });
  }

  const response = await fetch(path, {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(method !== "GET" ? { "X-CSRFToken": getCsrfToken() } : {}),
      ...options.headers,
    },
  });

  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "No pudimos completar la acción.");
  return data;
}

function Field({ label, value, setValue, textarea = false, type = "text", required = false, disabled = false, hint }) {
  return (
    <label className="field">
      <span>{label}</span>
      {textarea ? (
        <textarea required={required} disabled={disabled} value={value} onChange={(event) => setValue(event.target.value)} />
      ) : (
        <input type={type} required={required} disabled={disabled} value={value} onChange={(event) => setValue(event.target.value)} />
      )}
      {hint && <small>{hint}</small>}
    </label>
  );
}

function SelectField({ label, value, setValue, options }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => setValue(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function RepeatableSection({ title, hint, items, addLabel, createItem, update, remove, children }) {
  return (
    <section className="form-section repeatable-section">
      <div className="repeatable-heading">
        <div>
          <h3>{title}</h3>
          <p className="section-hint">{hint}</p>
        </div>
        <button type="button" className="secondary-action" onClick={() => update([...items, createItem()])}>{addLabel}</button>
      </div>
      {items.map((item, index) => (
        <fieldset className="repeatable-item" key={index}>
          <legend>{title} {index + 1}</legend>
          {children(item, index, (key, value) => update(items.map((entry, itemIndex) => itemIndex === index ? { ...entry, [key]: value } : entry)))}
          <button type="button" className="remove-item" onClick={() => remove(index)}>Eliminar</button>
        </fieldset>
      ))}
      {!items.length && <p className="repeatable-empty">Todavía no agregaste información.</p>}
    </section>
  );
}

function Dialog({ children, onClose, className = "", backdropClassName = "" }) {
  return (
    <div className={`modal-backdrop ${backdropClassName}`} onMouseDown={onClose}>
      <section
        className={`dialog ${className}`}
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="close" onClick={onClose} aria-label="Cerrar ventana">
          Cerrar
        </button>
        {children}
      </section>
    </div>
  );
}

function ProfileCard({ profile, open, preview = false }) {
  const style = { ...defaultStyle, ...profile.style };
  const initials = `${profile.firstName?.[0] || ""}${profile.lastName?.[0] || ""}`.toUpperCase();
  return (
    <article
      className={`profile-card palette-${style.palette} font-${style.font} layout-${style.layout} align-${style.alignment}`}
    >
      {profile.isFeatured && <span className="featured-mark">Destacada</span>}
      <button
        type="button"
        className="card-main"
        onClick={() => !preview && open(profile.slug)}
        disabled={preview}
      >
        <span className="identity-mark" aria-hidden="true">{initials}</span>
        <span className="card-copy">
          <span className="card-index">{profile.title || "Developer"}</span>
          <h2>
            {profile.firstName} <em>{profile.lastName}</em>
          </h2>
          {profile.location && <span className="location">{profile.location}</span>}
        </span>
        {profile.introduction && <span className="card-introduction">{profile.introduction}</span>}
        <div className="skill-row">
          {(profile.skills || []).slice(0, 4).map((skill) => (
            <span key={skill}>{skill}</span>
          ))}
          {calculateYears(profile.experiences) > 0 && <span className="years-badge">{calculateYears(profile.experiences)} años exp.</span>}
        </div>
      </button>
      <div className="card-footer">
        <span>{(profile.workModes || []).join(" · ") || "Modalidad abierta"}</span>
        <div className="contact-links">
          {profile.contacts?.email && <a href={`mailto:${profile.contacts.email}`}>Email</a>}
          {profile.contacts?.linkedin && (
            <a href={profile.contacts.linkedin} target="_blank" rel="noreferrer">
              LinkedIn
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

function AccountDialog({ close, authenticated }) {
  const [registering, setRegistering] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await api(registering ? "/api/auth/register/" : "/api/auth/login/", {
        method: "POST",
        body: JSON.stringify(form),
      });
      await authenticated(registering);
      close();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog onClose={close} className="account-dialog">
      <h2>{registering ? "Dejá tu huella." : "Volvé a tu tarjeta."}</h2>
      <form className="form-grid" onSubmit={submit}>
        {registering && (
          <div className="split-fields">
            <Field
              label="Nombre"
              value={form.firstName}
              setValue={(firstName) => setForm({ ...form, firstName })}
              required
            />
            <Field
              label="Apellido"
              value={form.lastName}
              setValue={(lastName) => setForm({ ...form, lastName })}
              required
            />
          </div>
        )}
        <Field
          label="Correo"
          type="email"
          value={form.email}
          setValue={(email) => setForm({ ...form, email })}
          required
        />
        <Field
          label="Contraseña"
          type="password"
          value={form.password}
          setValue={(password) => setForm({ ...form, password })}
          required
        />
        {error && <p className="form-error">{error}</p>}
        <button className="primary-action" disabled={submitting}>
          {submitting ? "Procesando…" : registering ? "Crear cuenta" : "Iniciar sesión"}
        </button>
      </form>
      <button type="button" className="text-action" onClick={() => setRegistering(!registering)}>
        {registering ? "Ya tengo una cuenta" : "No tengo cuenta todavía"}
      </button>
    </Dialog>
  );
}

function ChoiceGroup({ legend, values, selected, onToggle, className = "" }) {
  return (
    <fieldset className={`choice-group ${className}`}>
      <legend>{legend}</legend>
      <div>
        {values.map((option) => (
          <label key={option.value}>
            <input
              type="checkbox"
              checked={selected.includes(option.value)}
              onChange={() => onToggle(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function SkillPicker({ label, hint, options, selected, onChange, variant = "default" }) {
  const [query, setQuery] = useState("");
  const inputId = useId();
  const suggestionsId = `${inputId}-suggestions`;
  const normalizedQuery = query.trim().toLocaleLowerCase("es");
  const suggestions = normalizedQuery
    ? options
        .filter((skill) => !selected.includes(skill.slug))
        .filter((skill) => skill.name.toLocaleLowerCase("es").includes(normalizedQuery))
        .sort((first, second) => {
          const firstStarts = first.name.toLocaleLowerCase("es").startsWith(normalizedQuery);
          const secondStarts = second.name.toLocaleLowerCase("es").startsWith(normalizedQuery);
          return Number(secondStarts) - Number(firstStarts) || first.name.localeCompare(second.name, "es");
        })
        .slice(0, 8)
    : [];

  function addSkill(slug) {
    onChange([...selected, slug]);
    setQuery("");
  }

  function removeSkill(slug) {
    onChange(selected.filter((value) => value !== slug));
  }

  return (
    <div className={`skill-selector skill-selector-${variant}`}>
      <label className="skill-selector-label" htmlFor={inputId}>{label}</label>
      {hint && <p className="skill-selector-hint" id={`${inputId}-hint`}>{hint}</p>}
      <input
        id={inputId}
        type="search"
        value={query}
        placeholder="Escribí para buscar"
        autoComplete="off"
        aria-describedby={hint ? `${inputId}-hint` : undefined}
        aria-controls={suggestionsId}
        aria-expanded={Boolean(suggestions.length)}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && normalizedQuery && suggestions.length) {
            event.preventDefault();
            addSkill(suggestions[0].slug);
          }
        }}
      />

      {selected.length > 0 && (
        <div className="selected-skills" aria-label={`${label}: seleccionadas`}>
          {selected.map((slug) => {
            const skill = options.find((option) => option.slug === slug);
            return (
              <button key={slug} type="button" onClick={() => removeSkill(slug)} aria-label={`Quitar ${skill?.name || slug}`}>
                {skill?.name || slug} <span aria-hidden="true">×</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="skill-suggestion-status" role="status" aria-live="polite">
        {normalizedQuery && !suggestions.length ? "No hay habilidades que coincidan." : ""}
      </div>
      {suggestions.length > 0 && (
        <ul className="skill-suggestions" id={suggestionsId} aria-label="Sugerencias de habilidades">
          {suggestions.map((skill) => (
            <li key={skill.slug}>
              <button type="button" onClick={() => addSkill(skill.slug)}>{skill.name}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LanguagePicker({ label, options, selected, onChange }) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const inputId = useId();
  const suggestionsId = `${inputId}-suggestions`;
  const normalizedQuery = query.trim().toLocaleLowerCase("es");
  const suggestions = isOpen
    ? options
        .filter((language) => !selected.includes(language))
        .filter((language) => !normalizedQuery || language.toLocaleLowerCase("es").includes(normalizedQuery))
        .sort((first, second) => {
          const firstStarts = first.toLocaleLowerCase("es").startsWith(normalizedQuery);
          const secondStarts = second.toLocaleLowerCase("es").startsWith(normalizedQuery);
          return Number(secondStarts) - Number(firstStarts) || first.localeCompare(second, "es");
        })
    : [];

  function addLanguage(language) {
    onChange([...selected, language]);
    setQuery("");
    setIsOpen(false);
  }

  return (
    <div className="language-picker">
      <label className="language-picker-label" htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        type="search"
        role="combobox"
        value={query}
        placeholder="Escribí para buscar"
        autoComplete="off"
        aria-autocomplete="list"
        aria-controls={suggestionsId}
        aria-expanded={Boolean(suggestions.length)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        onChange={(event) => {
          setQuery(event.target.value);
          setIsOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && suggestions.length) {
            event.preventDefault();
            addLanguage(suggestions[0]);
          }
          if (event.key === "Escape") setIsOpen(false);
        }}
      />

      {selected.length > 0 && (
        <div className="selected-languages" aria-label="Idiomas seleccionados">
          {selected.map((language) => (
            <button
              key={language}
              type="button"
              onClick={() => onChange(selected.filter((value) => value !== language))}
              aria-label={`Quitar ${language}`}
            >
              {language} <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      )}

      <div className="language-suggestion-status" role="status" aria-live="polite">
        {normalizedQuery && !suggestions.length ? "No hay idiomas que coincidan." : ""}
      </div>
      {suggestions.length > 0 && (
        <ul className="language-suggestions" id={suggestionsId} role="listbox" aria-label="Sugerencias de idiomas">
          {suggestions.map((language) => (
            <li key={language} role="option" aria-selected="false">
              <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => addLanguage(language)}>{language}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProfileEditor({ profile, skillOptions, close, saved }) {
  const [draft, setDraft] = useState(profile);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const update = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const updateStyle = (key, value) =>
    setDraft((current) => ({ ...current, style: { ...current.style, [key]: value } }));

  const preview = {
    ...draft,
    location: [draft.city, draft.region, draft.country].filter(Boolean).join(", "),
    skills: draft.skills.map((slug) => skillOptions.find((skill) => skill.slug === slug)?.name || slug),
    workModes: draft.workModes.map(modeLabel),
    contacts: {
      email: draft.visibleContacts.includes("email") ? draft.email : null,
      linkedin: draft.visibleContacts.includes("linkedin") ? draft.linkedin : null,
    },
  };

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const result = await api("/api/me/profile/", {
        method: "PUT",
        body: JSON.stringify(draft),
      });
      saved(result);
      close();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog onClose={close} className="editor-dialog">
      <div className="editor-copy">
        <h2>Tu tarjeta, con tus reglas.</h2>
        <p>Completá tu perfil y elegí cuánto querés mostrar. Los cambios visuales aparecen en la vista previa.</p>
        <form className="profile-form" onSubmit={submit}>
          <section className="form-section">
            <h3>Identidad profesional</h3>
            <div className="split-fields">
              <Field label="Nombre" value={draft.firstName} setValue={(value) => update("firstName", value)} required />
              <Field label="Apellido" value={draft.lastName} setValue={(value) => update("lastName", value)} required />
            </div>
            <Field label="Título" value={draft.title} setValue={(value) => update("title", value)} required />
            <Field
              label="Presentación"
              textarea
              value={draft.introduction}
              setValue={(value) => update("introduction", value)}
            />
          </section>

          <RepeatableSection
            title="Experiencia"
            hint="Sumá empleos, proyectos o colaboraciones en el orden en que querés mostrarlos."
            items={draft.experiences}
            addLabel="Agregar experiencia"
            createItem={() => ({ company: "", role: "", start: "", end: "", current: false, description: "", technologies: [] })}
            update={(experiences) => update("experiences", experiences)}
            remove={(index) => update("experiences", draft.experiences.filter((_, itemIndex) => itemIndex !== index))}
          >
            {(item, _index, change) => <>
              <div className="split-fields">
                <Field label="Empresa" value={item.company} setValue={(value) => change("company", value)} />
                <Field label="Rol" value={item.role} setValue={(value) => change("role", value)} />
              </div>
              <div className="split-fields">
                <Field label="Desde" type="month" value={item.start} setValue={(value) => change("start", value)} />
                <Field label="Hasta" type="month" disabled={item.current} value={item.end} setValue={(value) => change("end", value)} />
              </div>
              <label className="inline-check"><input type="checkbox" checked={item.current} onChange={(event) => change("current", event.target.checked)} /> Actualmente</label>
              <Field label="Descripción" textarea value={item.description} setValue={(value) => change("description", value)} />
              <Field label="Tecnologías" value={item.technologies.join(", ")} setValue={(value) => change("technologies", value.split(",").map((technology) => technology.trim()).filter(Boolean))} hint="Separalas con comas." />
            </>}
          </RepeatableSection>

          <RepeatableSection
            title="Idiomas"
            hint="Indicá el idioma y cómo describís tu dominio."
            items={draft.languages}
            addLabel="Agregar idioma"
            createItem={() => ({ language: "", proficiency: "" })}
            update={(languages) => update("languages", languages)}
            remove={(index) => update("languages", draft.languages.filter((_, itemIndex) => itemIndex !== index))}
          >
            {(item, _index, change) => <div className="split-fields">
              <Field label="Idioma" value={item.language} setValue={(value) => change("language", value)} />
              <Field label="Nivel" value={item.proficiency} setValue={(value) => change("proficiency", value)} />
            </div>}
          </RepeatableSection>

          <RepeatableSection
            title="Educación"
            hint="Agregá formación formal, cursos extensos o certificaciones relevantes."
            items={draft.education}
            addLabel="Agregar educación"
            createItem={() => ({ institution: "", degree: "", field: "", start: "", end: "" })}
            update={(education) => update("education", education)}
            remove={(index) => update("education", draft.education.filter((_, itemIndex) => itemIndex !== index))}
          >
            {(item, _index, change) => <>
              <Field label="Institución" value={item.institution} setValue={(value) => change("institution", value)} />
              <div className="split-fields">
                <Field label="Título" value={item.degree} setValue={(value) => change("degree", value)} />
                <Field label="Área" value={item.field} setValue={(value) => change("field", value)} />
              </div>
              <div className="split-fields">
                <Field label="Desde" type="month" value={item.start} setValue={(value) => change("start", value)} />
                <Field label="Hasta" type="month" value={item.end} setValue={(value) => change("end", value)} />
              </div>
            </>}
          </RepeatableSection>

          <section className="form-section">
            <h3>Ubicación</h3>
            <p className="section-hint">Es opcional. Si la omitís, tu perfil no aparecerá en búsquedas por ubicación.</p>
            <div className="location-fields">
              <Field label="País" value={draft.country} setValue={(value) => update("country", value)} />
              <Field label="Región / provincia" value={draft.region} setValue={(value) => update("region", value)} />
              <Field label="Ciudad" value={draft.city} setValue={(value) => update("city", value)} />
            </div>
            <ChoiceGroup
              legend="Modalidad de trabajo"
              values={workModes}
              selected={draft.workModes}
              onToggle={(value) => update("workModes", toggle(draft.workModes, value))}
            />
          </section>

          <section className="form-section">
            <h3>Contacto y portfolio</h3>
            <Field label="Correo" type="email" value={draft.email} setValue={(value) => update("email", value)} />
            <Field label="LinkedIn" type="url" value={draft.linkedin} setValue={(value) => update("linkedin", value)} />
            <Field label="Portfolio" type="url" value={draft.portfolio} setValue={(value) => update("portfolio", value)} />
            <ChoiceGroup
              legend="Contactos visibles"
              values={[
                { value: "email", label: "Mostrar correo" },
                { value: "linkedin", label: "Mostrar LinkedIn" },
              ]}
              selected={draft.visibleContacts}
              onToggle={(value) => update("visibleContacts", toggle(draft.visibleContacts, value))}
            />
          </section>

          <section className="form-section">
            <h3>Habilidades</h3>
            <SkillPicker
              label="Buscar y seleccionar habilidades"
              hint="Podés buscar por nombre. Presioná Enter para elegir la primera coincidencia."
              options={skillOptions}
              selected={draft.skills}
              onChange={(skills) => update("skills", skills)}
            />
          </section>

          <section className="form-section appearance-section">
            <h3>Apariencia controlada</h3>
            <div className="appearance-fields">
              <SelectField label="Paleta" value={draft.style.palette} setValue={(value) => updateStyle("palette", value)} options={appearanceOptions.palette} />
              <SelectField label="Tipografía" value={draft.style.font} setValue={(value) => updateStyle("font", value)} options={appearanceOptions.font} />
              <SelectField label="Layout" value={draft.style.layout} setValue={(value) => updateStyle("layout", value)} options={appearanceOptions.layout} />
              <SelectField label="Alineación" value={draft.style.alignment} setValue={(value) => updateStyle("alignment", value)} options={appearanceOptions.alignment} />
            </div>
          </section>

          <label className="publication-row">
            <input
              type="checkbox"
              checked={draft.isPublished}
              onChange={(event) => update("isPublished", event.target.checked)}
            />
            <span>
              <strong>Publicar ahora</strong>
              Tu perfil será visible inmediatamente en el directorio.
            </span>
          </label>

          {error && <p className="form-error editor-feedback">{error}</p>}
          <div className="editor-actions">
            <button className="primary-action" disabled={submitting}>
              {submitting ? "Guardando…" : "Guardar perfil"}
            </button>
            <button type="button" className="secondary-action" onClick={close}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
      <aside className="live-preview">
        <strong>Vista previa</strong>
        <ProfileCard profile={preview} preview />
      </aside>
    </Dialog>
  );
}

function ProfileDetail({ profile, owner = false, onEdit }) {
  const [shareStatus, setShareStatus] = useState("");
  const profileUrl = `${window.location.origin}/developers/${profile.slug}`;
  const style = { ...defaultStyle, ...profile.style };

  async function copyProfileUrl() {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setShareStatus("Enlace copiado");
    } catch {
      setShareStatus("No pudimos copiarlo. Seleccioná el enlace.");
    }
  }

  async function shareProfile() {
    if (!navigator.share) {
      await copyProfileUrl();
      return;
    }

    try {
      await navigator.share({
        title: `${profile.firstName} ${profile.lastName} en yoDev`,
        text: `Conocé el perfil de ${profile.firstName} ${profile.lastName}.`,
        url: profileUrl,
      });
      setShareStatus("Perfil compartido");
    } catch (failure) {
      if (failure.name !== "AbortError") setShareStatus("No pudimos abrir las opciones para compartir.");
    }
  }

  return (
    <div className="profile-page-body">
      <div className="share-toolbar" aria-label="Opciones para compartir el perfil">
        <div className="share-link">
          <span>Enlace público</span>
          <a href={profileUrl}>{profileUrl}</a>
        </div>
        <div className="share-actions">
          {owner && <button type="button" onClick={onEdit}>Editar mi perfil</button>}
          <button type="button" onClick={copyProfileUrl}>Copiar enlace</button>
          <button type="button" onClick={shareProfile}>Compartir</button>
          <button type="button" className="print-action" onClick={() => window.print()}>Imprimir A4</button>
        </div>
        <p className="share-status" role="status" aria-live="polite">{shareStatus}</p>
      </div>

      <article className={`resume-profile palette-${style.palette} font-${style.font} align-${style.alignment}`}>
        <header className="resume-hero">
          <div className="virtual-card-heading">
            <span>{profile.title || "Developer"}</span>
            <h2>{profile.firstName} <em>{profile.lastName}</em></h2>
          </div>

          <p className="profile-introduction">{profile.introduction}</p>
          <div className="resume-meta">
            <span>{profile.location || "Ubicación abierta"}</span>
            <span>{profile.workModes.join(" · ") || "Modalidad a conversar"}</span>
            {calculateYears(profile.experiences) > 0 && <span>{calculateYears(profile.experiences)} años de experiencia</span>}
          </div>
        </header>

        <div className="resume-content">
          <div className="resume-main-column">
            <section className="resume-section">
              <h2>Experiencia</h2>
              <div className="timeline-list">
                {profile.experiences.map((item, index) => <article key={`${item.company}-${item.role}-${index}`}>
                  <div className="timeline-heading"><div><h3>{item.role || "Rol sin especificar"}</h3><p>{item.company}</p></div><time>{formatPeriod(item.start, item.current ? "Actualidad" : item.end)}</time></div>
                  {item.description && <p className="timeline-description">{item.description}</p>}
                  {item.technologies.length > 0 && <div className="skill-row">{item.technologies.map((technology) => <span key={technology}>{technology}</span>)}</div>}
                </article>)}
                {!profile.experiences.length && <p className="resume-empty">Sin experiencia cargada.</p>}
              </div>
            </section>

            <section className="resume-section">
              <h2>Educación</h2>
              <div className="timeline-list">
                {profile.education.map((item, index) => <article key={`${item.institution}-${item.degree}-${index}`}>
                  <div className="timeline-heading"><div><h3>{item.degree || item.field || "Formación"}</h3><p>{[item.institution, item.degree && item.field].filter(Boolean).join(" · ")}</p></div><time>{formatPeriod(item.start, item.end)}</time></div>
                </article>)}
                {!profile.education.length && <p className="resume-empty">Sin educación cargada.</p>}
              </div>
            </section>
          </div>

          <aside className="resume-side-column">
            <section className="resume-section">
              <h2>Habilidades</h2>
              <div className="skill-row">
                {profile.skills.map((skill) => <span key={skill}>{skill}</span>)}
                {!profile.skills.length && <span>Sin especificar</span>}
              </div>
            </section>
            <section className="resume-section">
              <h2>Idiomas</h2>
              <dl className="language-list">
                {profile.languages.map((item, index) => <div key={`${item.language}-${index}`}><dt>{item.language || "Sin especificar"}</dt><dd>{item.proficiency || "Nivel abierto"}</dd></div>)}
              </dl>
              {!profile.languages.length && <p className="resume-empty">Sin idiomas cargados.</p>}
            </section>
            <section className="resume-section">
              <h2>Contacto y portfolio</h2>
              <div className="visible-contacts" aria-label="Contactos públicos">
            {profile.contacts.email && (
              <a href={`mailto:${profile.contacts.email}`}>
                <span>Email</span>
                <strong>{profile.contacts.email}</strong>
              </a>
            )}
            {profile.contacts.linkedin && (
              <a href={profile.contacts.linkedin} target="_blank" rel="noreferrer">
                <span>LinkedIn</span>
                <strong>{profile.contacts.linkedin}</strong>
              </a>
            )}
            {profile.portfolio && (
              <a href={profile.portfolio} target="_blank" rel="noreferrer">
                <span>Portfolio</span>
                <strong>{profile.portfolio}</strong>
              </a>
            )}
                {!profile.contacts.email && !profile.contacts.linkedin && !profile.portfolio && <p className="resume-empty">Sin contactos públicos.</p>}
              </div>
            </section>
            <aside className="profile-qr" aria-label="Código QR del perfil público">
          <span className="qr-wordmark">yo<strong>Dev</strong></span>
          <QRCodeSVG
            value={profileUrl}
            title={`Código QR del perfil público de ${profile.firstName} ${profile.lastName}`}
            size={220}
            level="Q"
            marginSize={4}
            bgColor="#ffffff"
            fgColor="#101538"
          />
          <p>Escaneá para guardar o compartir este perfil.</p>
          <a href={profileUrl}>{profileUrl}</a>
            </aside>
          </aside>
        </div>
      </article>

      <section className="print-sheet" aria-hidden="true">
        {Array.from({ length: 10 }, (_, index) => (
          <article key={index} className={`print-card-copy palette-${style.palette} font-${style.font} align-${style.alignment}`}>
            <div>
              <span className="print-copy-role">{profile.title || "Developer"}</span>
              <h2>{profile.firstName} <em>{profile.lastName}</em></h2>
              {profile.location && <p>{profile.location}</p>}
              <div className="print-copy-skills">{profile.skills.slice(0, 4).map((skill) => <span key={skill}>{skill}</span>)}</div>
              <div className="print-copy-contacts">{profile.contacts.email && <span>{profile.contacts.email}</span>}{profile.contacts.linkedin && <span>LinkedIn</span>}</div>
            </div>
            <div className="print-copy-qr"><QRCodeSVG value={profileUrl} title={`QR de ${profile.firstName} ${profile.lastName}`} size={96} level="Q" marginSize={4} bgColor="#ffffff" fgColor="#101538" /><small>{profileUrl}</small></div>
          </article>
        ))}
      </section>
    </div>
  );
}

function formatPeriod(start, end) {
  if (!start && !end) return "";
  return [start || "Inicio abierto", end || "Actualidad"].join(" — ");
}

function Pagination({ data, change }) {
  if (!data || data.pages < 2) return null;
  return (
    <nav className="pagination" aria-label="Paginación">
      <button disabled={!data.hasPrevious} onClick={() => change(data.page - 1)}>
        Anterior
      </button>
      <span>
        Página {data.page} de {data.pages}
      </span>
      <button disabled={!data.hasNext} onClick={() => change(data.page + 1)}>
        Siguiente
      </button>
    </nav>
  );
}

function AdminPanel({ close }) {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [reviewFilter, setReviewFilter] = useState("all");
  const [error, setError] = useState("");

  async function load() {
    setError("");
    const query = new URLSearchParams({ page });
    if (reviewFilter !== "all") query.set("review", reviewFilter);
    try {
      setData(await api(`/api/admin/dashboard/?${query}`));
    } catch (failure) {
      setError(failure.message);
    }
  }

  useEffect(() => {
    load();
  }, [page, reviewFilter]);

  async function review(id) {
    try {
      await api(`/api/admin/profiles/${id}/`, { method: "POST" });
      await load();
    } catch (failure) {
      setError(failure.message);
    }
  }

  async function remove(id) {
    if (!window.confirm("¿Eliminar este perfil definitivamente?")) return;
    try {
      await api(`/api/admin/profiles/${id}/`, { method: "DELETE" });
      await load();
    } catch (failure) {
      setError(failure.message);
    }
  }

  return (
    <Dialog onClose={close} className="admin-dialog">
      <div className="admin-heading">
        <div>
          <h2>Control de yoDev</h2>
          <p>Revisá altas y cambios posteriores sin perder el contexto.</p>
        </div>
        <label className="field admin-filter">
          <span>Estado de revisión</span>
          <select
            value={reviewFilter}
            onChange={(event) => {
              setReviewFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">Todos los perfiles</option>
            <option value="pending">Sin revisar</option>
            <option value="changed">Modificados después de revisar</option>
          </select>
        </label>
      </div>

      {error && <p className="form-error">{error}</p>}
      {!data ? (
        <div className="loading-block" aria-label="Cargando panel" />
      ) : (
        <>
          <div className="admin-summary">
            <span><strong>{data.summary.pendingReview}</strong> sin revisar</span>
            <span><strong>{data.summary.published}</strong> publicados</span>
          </div>

          <div className="section-heading">
            <h3>Perfiles</h3>
            <span>{data.pagination.total} resultados</span>
          </div>
          <div className="admin-list profile-admin-list">
            {data.profiles.map((profile) => (
              <article key={profile.id}>
                <div>
                  <strong>{profile.firstName} {profile.lastName}</strong>
                  <span>{profile.title}</span>
                </div>
                <span className={`review-status ${profile.needsReviewAttention ? "changed" : profile.isReviewed ? "reviewed" : "pending"}`}>
                  {profile.needsReviewAttention
                    ? "Cambió después de revisión"
                    : profile.isReviewed
                      ? "Revisado"
                      : "Sin revisar"}
                </span>
                <time dateTime={profile.updatedAt}>
                  {new Date(profile.updatedAt).toLocaleDateString("es-AR")}
                </time>
                <button onClick={() => review(profile.id)}>
                  {profile.needsReviewAttention ? "Revisar cambios" : "Marcar revisado"}
                </button>
                <button className="delete-action" onClick={() => remove(profile.id)}>Eliminar</button>
              </article>
            ))}
            {!data.profiles.length && (
              <p className="empty-state">No hay perfiles que coincidan con este filtro.</p>
            )}
          </div>
          <Pagination data={data.pagination} change={setPage} />
        </>
      )}
    </Dialog>
  );
}

function PublicFilters({ skills, filters, setFilters, collapsed, onToggleFilters }) {
  const update = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  return (
    <aside className="filter-area" aria-label="Filtros del directorio" aria-hidden={collapsed}>
      <div className="filter-heading">
        <div>
          <h2>Filtrar perfiles</h2>
          <p>Los resultados cambian con cada selección.</p>
        </div>
        {onToggleFilters && (
          <button type="button" className="mobile-filters-toggle" onClick={() => onToggleFilters(!collapsed)} aria-expanded={!collapsed}>
            {collapsed ? "Mostrar filtros" : "Ocultar filtros"}
          </button>
        )}
      </div>
      <div className={collapsed ? "filter-body is-collapsed" : "filter-body"}>
      <div className="filter-group">
        <h3>Habilidades obligatorias</h3>
        <p>El perfil debe incluir todas las seleccionadas.</p>
        <SkillPicker
          label="Buscar habilidades obligatorias"
          options={skills}
          selected={filters.required}
          onChange={(required) => update("required", required)}
        />
      </div>
      <div className="filter-group optional">
        <h3>Habilidades deseables</h3>
        <p>Mejoran la relevancia, pero no excluyen perfiles.</p>
        <SkillPicker
          label="Buscar habilidades deseables"
          options={skills}
          selected={filters.optional}
          onChange={(optional) => update("optional", optional)}
          variant="optional"
        />
      </div>
      <div className="location-filter-group">
        <h3>Ubicación</h3>
        <div className="public-location-fields">
          <Field label="País" value={filters.country} setValue={(value) => update("country", value)} />
          <Field label="Región / provincia" value={filters.region} setValue={(value) => update("region", value)} />
          <Field label="Ciudad" value={filters.city} setValue={(value) => update("city", value)} />
        </div>
        <ChoiceGroup
          legend="Modalidad"
          values={workModes}
          selected={filters.workModes}
          onToggle={(value) => update("workModes", toggle(filters.workModes, value))}
          className="public-mode-filter"
        />
      </div>
      <div className="filter-group language-filter-group">
        <h3>Idiomas</h3>
        <p>El perfil debe incluir todos los seleccionados.</p>
        <LanguagePicker
          label="Buscar idiomas"
          options={commonLanguages}
          selected={filters.languages}
          onChange={(languages) => update("languages", languages)}
        />
      </div>
      <div className="filter-group">
        <h3>Experiencia</h3>
        <label className="field">
          <span>Mínimo años de experiencia</span>
          <input type="number" min="0" max="50" value={filters.minYears} onChange={(event) => update("minYears", Math.max(0, Number(event.target.value) || 0))} />
        </label>
      </div>
      <div className="filter-footer">
        <label>
          Ordenar
          <select value={filters.sort} onChange={(event) => update("sort", event.target.value)}>
            <option value="last_name">Apellido</option>
            <option value="relevance">Más coincidencias deseables</option>
          </select>
        </label>
        <button type="button" className="clear-action" onClick={() => setFilters({ required: [], optional: [], languages: [], country: "", region: "", city: "", workModes: [], minYears: 0, sort: "last_name" })}>
          Limpiar filtros
        </button>
      </div>
      </div>
    </aside>
  );
}

const BASE_URL = "https://yodev-api.primera-fila-s.workers.dev";

function setMeta(attribute, name, content) {
  let element = document.head.querySelector(`meta[${attribute}="${name}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, name);
    document.head.appendChild(element);
  }
  if (content) element.setAttribute("content", content);
}

function setTitle(title) {
  document.title = title;
}

function resetMetaTags() {
  setTitle("yoDev — El board de quienes construyen lo que sigue");
  setMeta("property", "og:title", "yoDev — El board de quienes construyen lo que sigue");
  setMeta("property", "og:description", "Directorio público de desarrolladores. Creá tu tarjeta profesional y descubrí perfiles por habilidades, ubicación y modalidad.");
  setMeta("property", "og:url", `${BASE_URL}/`);
  setMeta("name", "description", "Directorio público de desarrolladores. Creá tu tarjeta profesional, descubrí perfiles por habilidades, ubicación y modalidad, y compartí tu perfil con código QR.");
}

function applyProfileMetaTags(profile) {
  const fullName = `${profile.firstName} ${profile.lastName}`.trim();
  const titleText = `${fullName} — ${profile.title || "Developer"} en yoDev`;
  const description = profile.introduction
    ? `${profile.introduction}`.slice(0, 150)
    : `Conocé el perfil de ${fullName} en yoDev.`;
  const url = `${BASE_URL}/developers/${profile.slug}`;
  document.title = titleText;
  setMeta("name", "description", description);
  setMeta("property", "og:title", titleText);
  setMeta("property", "og:description", description);
  setMeta("property", "og:url", url);
  setMeta("property", "og:type", "profile");
  setMeta("property", "profile:first_name", profile.firstName);
  setMeta("property", "profile:last_name", profile.lastName);
}

function App() {
  const [skillOptions, setSkillOptions] = useState(fallbackSkills);
  const [filters, setFilters] = useState({
    required: [],
    optional: [],
    languages: [],
    country: "",
    region: "",
    city: "",
    workModes: [],
    minYears: 0,
    sort: "last_name",
  });
  const [page, setPage] = useState(1);
  const [profiles, setProfiles] = useState(demoProfiles);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 1, hasNext: false, hasPrevious: false });
  const [account, setAccount] = useState(null);
  const [detail, setDetail] = useState(null);
  const [routeSlug, setRouteSlug] = useState(() => window.location.pathname.match(/^\/developers\/([^/]+)\/?$/)?.[1] || null);
  const [notice, setNotice] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);

  const editorProfile = account
    ? {
        ...blankProfile,
        ...account,
        ...account.editable,
        style: { ...defaultStyle, ...account.style },
        skills: account.editable?.skills || [],
        visibleContacts: account.editable?.visibleContacts || [],
        workModes: account.editable?.workModes || [],
        isPublished: account.editable?.isPublished || false,
      }
    : blankProfile;

  async function refreshAccount(openEditor = false) {
    try {
      const profile = await api("/api/me/profile/");
      setAccount(profile);
      if (openEditor) setEditorOpen(true);
      return profile;
    } catch {
      setAccount(null);
      return null;
    }
  }

  async function loadDetail(slug) {
    if (!slug) {
      setDetail(null);
      resetMetaTags();
      return;
    }
    try {
      const loaded = normalizeProfile(await api(`/api/profiles/${slug}/`));
      setDetail(loaded);
      applyProfileMetaTags(loaded);
    } catch {
      const fallback = demoProfiles.find((profile) => profile.slug === slug);
      setDetail(fallback || null);
      if (fallback) applyProfileMetaTags(fallback);
      else setNotice("Ese perfil no está disponible.");
    }
  }

  useEffect(() => {
    refreshAccount();
    api("/api/skills/")
      .then((data) => setSkillOptions(data.results))
      .catch(() => setSkillOptions(fallbackSkills));
    loadDetail(routeSlug);

    const handleHistory = () => {
      const slug = window.location.pathname.match(/^\/developers\/([^/]+)\/?$/)?.[1];
      setRouteSlug(slug || null);
      loadDetail(slug);
    };
    window.addEventListener("popstate", handleHistory);
    return () => window.removeEventListener("popstate", handleHistory);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  useEffect(() => {
    const query = new URLSearchParams({
      required_skills: filters.required.join(","),
      optional_skills: filters.optional.join(","),
      languages: filters.languages.join(","),
      country: filters.country.trim(),
      region: filters.region.trim(),
      city: filters.city.trim(),
      work_modes: filters.workModes.join(","),
      min_years: filters.minYears,
      sort: filters.sort,
      page,
    });

    api(`/api/profiles/?${query}`)
      .then((data) => {
        setProfiles(data.results.map(normalizeProfile));
        setPagination(data.pagination);
      })
      .catch(() => {
        const fallback = filterFallbackProfiles(filters);
        setProfiles(fallback);
        setPagination({ page: 1, pages: 1, total: fallback.length, hasNext: false, hasPrevious: false });
      });
  }, [filters, page]);

  function openProfile(slug) {
    window.history.pushState({}, "", `/developers/${slug}`);
    setRouteSlug(slug);
    setDetail(null);
    loadDetail(slug);
  }

  function closeProfile() {
    window.history.pushState({}, "", "/");
    setRouteSlug(null);
    setDetail(null);
    resetMetaTags();
  }

  async function logout() {
    try {
      await api("/api/auth/logout/", { method: "POST" });
      setAccount(null);
      setEditorOpen(false);
      setAdminOpen(false);
      setNotice("Cerraste sesión correctamente.");
    } catch (failure) {
      setNotice(failure.message);
    }
  }

  function profileSaved(profile) {
    setAccount(profile);
    setNotice(profile.editable?.isPublished ? "Tu perfil quedó publicado." : "Guardamos tu perfil como borrador.");
    setFilters((current) => ({ ...current }));
    if (routeSlug && routeSlug === account.slug) loadDetail(routeSlug);
  }

  if (routeSlug) return (
    <main className="profile-page">
      <header className="masthead profile-masthead">
        <a className="wordmark" href="/">yo<strong>Dev</strong></a>
        <a className="back-link" href="/" onClick={(event) => { event.preventDefault(); closeProfile(); }}>Volver al directorio</a>
      </header>
      {detail ? <ProfileDetail profile={detail} owner={account?.slug === detail.slug} onEdit={() => setEditorOpen(true)} /> : <div className="profile-loading">{notice || "Cargando perfil…"}</div>}
      {editorOpen && account && (
        <ProfileEditor
          profile={editorProfile}
          skillOptions={skillOptions}
          close={() => setEditorOpen(false)}
          saved={profileSaved}
        />
      )}
    </main>
  );

  return (
    <main>
      <header className="masthead">
        <a className="wordmark" href="/">yo<strong>Dev</strong></a>
        <nav aria-label="Navegación principal">
          <a href="#directory">Explorar</a>
          {account?.isAdmin && <button onClick={() => setAdminOpen(true)}>Administrar</button>}
          {account ? (
            <>
              <button onClick={() => openProfile(account.slug)}>Mi perfil</button>
              <button className="logout-action" onClick={logout}>Cerrar sesión</button>
            </>
          ) : (
            <button className="join" onClick={() => setAuthOpen(true)}>Crear mi tarjeta</button>
          )}
        </nav>
      </header>

      {notice && (
        <div className="notice" role="status">
          <span>{notice}</span>
          <button onClick={() => setNotice("")} aria-label="Descartar aviso">Cerrar</button>
        </div>
      )}

      <section className="intro">
        <h1 className="intro-copy">El board de quienes <strong>construyen lo que sigue.</strong></h1>
      </section>

      <div className="directory-layout">
        <PublicFilters skills={skillOptions} filters={filters} setFilters={setFilters} collapsed={filtersCollapsed} onToggleFilters={setFiltersCollapsed} />
        <div className="directory-results">
          <div className="results-heading">
            <h2>Directorio</h2>
            <p className="result-count">{pagination.total} perfiles en esta búsqueda</p>
          </div>
          <section id="directory" className="directory" aria-live="polite">
            {profiles.map((profile) => (
              <ProfileCard key={profile.id} profile={profile} open={openProfile} />
            ))}
            {!profiles.length && (
              <div className="directory-empty">
                <h2>No hay una coincidencia exacta.</h2>
                <p>Probá quitar una habilidad obligatoria o ampliar ubicación y modalidad.</p>
              </div>
            )}
          </section>
          <Pagination data={pagination} change={setPage} />
        </div>
      </div>

      <section className="join-section">
        <p>Tu experiencia también cuenta</p>
        <h2>Convertí lo que sabés hacer en una tarjeta que se recuerde.</h2>
        <button onClick={() => account ? setEditorOpen(true) : setAuthOpen(true)}>
          {account ? "Editar mi perfil" : "Crear mi tarjeta"}
        </button>
      </section>

      {authOpen && (
        <AccountDialog
          close={() => setAuthOpen(false)}
          authenticated={(registered) => refreshAccount(registered)}
        />
      )}
      {editorOpen && account && (
        <ProfileEditor
          profile={editorProfile}
          skillOptions={skillOptions}
          close={() => setEditorOpen(false)}
          saved={profileSaved}
        />
      )}
      {adminOpen && <AdminPanel close={() => setAdminOpen(false)} />}
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
