// biome-ignore-all lint/suspicious/noArrayIndexKey: las listas del perfil (links, estudios, skills, certificaciones, idiomas) no tienen id estable en el esquema; el orden es la identidad.
import { type ReactNode, useEffect, useState } from 'react';
import type { MasterProfile } from '../../shared/schemas';

type Experience = MasterProfile['experience'][number];
type Education = MasterProfile['education'][number];
type Skill = MasterProfile['skills'][number];
type Project = MasterProfile['projects'][number];
type Certification = MasterProfile['certifications'][number];
type Language = MasterProfile['languages'][number];
type Link = MasterProfile['basics']['links'][number];

const INPUT =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200';

/**
 * Editor del perfil maestro con formulario. Cubre todos los campos del
 * esquema; el modo JSON queda como alternativa avanzada en ProfilePage.
 */
export function ProfileForm({
  value,
  onChange,
}: {
  value: MasterProfile;
  onChange: (next: MasterProfile) => void;
}) {
  const setBasics = (patch: Partial<MasterProfile['basics']>) => {
    onChange({ ...value, basics: { ...value.basics, ...patch } });
  };

  const setExperiences = (experiences: Experience[]) =>
    onChange({ ...value, experience: experiences });
  const setEducation = (education: Education[]) => onChange({ ...value, education });
  const setSkills = (skills: Skill[]) => onChange({ ...value, skills });
  const setProjects = (projects: Project[]) => onChange({ ...value, projects });
  const setCertifications = (certifications: Certification[]) =>
    onChange({ ...value, certifications });
  const setLanguages = (languages: Language[]) => onChange({ ...value, languages });

  const updateExperience = (index: number, patch: Partial<Experience>) => {
    setExperiences(
      value.experience.map((experience, position) =>
        position === index ? { ...experience, ...patch } : experience,
      ),
    );
  };

  const updateBullet = (experienceIndex: number, bulletIndex: number, text: string) => {
    setExperiences(
      value.experience.map((experience, position) => {
        if (position !== experienceIndex) {
          return experience;
        }

        return {
          ...experience,
          bullets: experience.bullets.map((bullet, bulletPosition) =>
            bulletPosition === bulletIndex ? { ...bullet, text } : bullet,
          ),
        };
      }),
    );
  };

  return (
    <div className="mt-4 space-y-6">
      <Section
        title="Datos personales"
        description="El nombre aparece en el encabezado del CV y en el nombre de los PDFs."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre completo">
            <input
              value={value.basics.fullName}
              onChange={(event) => setBasics({ fullName: event.target.value })}
              className={INPUT}
            />
          </Field>
          <Field label="Titular (opcional)">
            <input
              value={value.basics.headline ?? ''}
              onChange={(event) => setBasics({ headline: optional(event.target.value) })}
              placeholder="Analista de datos"
              className={INPUT}
            />
          </Field>
          <Field label="Email (opcional)">
            <input
              type="email"
              value={value.basics.email ?? ''}
              onChange={(event) => setBasics({ email: optional(event.target.value) })}
              className={INPUT}
            />
          </Field>
          <Field label="Teléfono (opcional)">
            <input
              value={value.basics.phone ?? ''}
              onChange={(event) => setBasics({ phone: optional(event.target.value) })}
              className={INPUT}
            />
          </Field>
          <Field label="Ubicación (opcional)">
            <input
              value={value.basics.location ?? ''}
              onChange={(event) => setBasics({ location: optional(event.target.value) })}
              className={INPUT}
            />
          </Field>
        </div>

        <ListHeader
          title="Links"
          onAdd={() =>
            setBasics({ links: [...value.basics.links, { label: '', url: '' } satisfies Link] })
          }
          addLabel="Agregar link"
        />
        {value.basics.links.length === 0 ? (
          <Empty text="Sin links. Podés agregar LinkedIn, portfolio o GitHub." />
        ) : (
          <div className="mt-3 space-y-3">
            {value.basics.links.map((link, index) => (
              <div key={`${link.url}-${index}`} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
                <Field label="Texto">
                  <input
                    value={link.label}
                    onChange={(event) =>
                      setBasics({
                        links: value.basics.links.map((item, position) =>
                          position === index ? { ...item, label: event.target.value } : item,
                        ),
                      })
                    }
                    placeholder="LinkedIn"
                    className={INPUT}
                  />
                </Field>
                <Field label="URL">
                  <input
                    value={link.url}
                    onChange={(event) =>
                      setBasics({
                        links: value.basics.links.map((item, position) =>
                          position === index ? { ...item, url: event.target.value } : item,
                        ),
                      })
                    }
                    placeholder="https://…"
                    className={INPUT}
                  />
                </Field>
                <RemoveButton
                  label={`Eliminar link ${index + 1}`}
                  onClick={() =>
                    setBasics({
                      links: value.basics.links.filter((_, position) => position !== index),
                    })
                  }
                />
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Resumen profesional"
        description="Un párrafo breve con tu perfil. La IA lo adapta a cada oferta sin inventar hechos."
      >
        <Field label="Resumen">
          <textarea
            value={value.summary ?? ''}
            onChange={(event) => onChange({ ...value, summary: optional(event.target.value) })}
            rows={4}
            className={INPUT}
          />
        </Field>
      </Section>

      <Section
        title="Experiencia"
        description="Cada bullet es una fuente de verdad: la IA solo puede reescribir lo que existe acá."
      >
        <div className="mt-3 space-y-4">
          {value.experience.map((experience, index) => (
            <Card key={experience.id} title={experience.role || `Experiencia ${index + 1}`}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Puesto">
                  <input
                    value={experience.role}
                    onChange={(event) => updateExperience(index, { role: event.target.value })}
                    className={INPUT}
                  />
                </Field>
                <Field label="Empresa">
                  <input
                    value={experience.company}
                    onChange={(event) => updateExperience(index, { company: event.target.value })}
                    className={INPUT}
                  />
                </Field>
                <Field label="Inicio">
                  <input
                    value={experience.start}
                    onChange={(event) => updateExperience(index, { start: event.target.value })}
                    placeholder="2022"
                    className={INPUT}
                  />
                </Field>
                <Field label="Fin (vacío = actual)">
                  <input
                    value={experience.end ?? ''}
                    onChange={(event) =>
                      updateExperience(index, { end: optional(event.target.value) ?? null })
                    }
                    placeholder="Actual"
                    className={INPUT}
                  />
                </Field>
                <Field label="Ubicación (opcional)">
                  <input
                    value={experience.location ?? ''}
                    onChange={(event) =>
                      updateExperience(index, { location: optional(event.target.value) })
                    }
                    className={INPUT}
                  />
                </Field>
              </div>

              <ListHeader
                title="Bullets"
                onAdd={() =>
                  updateExperience(index, {
                    bullets: [...experience.bullets, { id: newId('bullet'), text: '' }],
                  })
                }
                addLabel="Agregar bullet"
              />
              {experience.bullets.length === 0 ? (
                <Empty text="Sin bullets. Agregá al menos uno para que la IA tenga de dónde partir." />
              ) : (
                <div className="mt-3 space-y-3">
                  {experience.bullets.map((bullet, bulletIndex) => (
                    <div key={bullet.id} className="flex items-start gap-2">
                      <textarea
                        value={bullet.text}
                        onChange={(event) => updateBullet(index, bulletIndex, event.target.value)}
                        rows={2}
                        placeholder="Logro o tarea concreta, con cifras si las tenés."
                        className={`${INPUT} mt-0`}
                      />
                      <RemoveButton
                        label={`Eliminar bullet ${bulletIndex + 1} de ${experience.role || 'la experiencia'}`}
                        onClick={() =>
                          updateExperience(index, {
                            bullets: experience.bullets.filter(
                              (_, position) => position !== bulletIndex,
                            ),
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() =>
                    setExperiences(value.experience.filter((_, position) => position !== index))
                  }
                  className="text-xs font-medium text-rose-700 underline decoration-rose-300 underline-offset-2 hover:text-rose-900"
                >
                  Eliminar esta experiencia
                </button>
              </div>
            </Card>
          ))}
        </div>

        <AddButton
          label="Agregar experiencia"
          onClick={() =>
            setExperiences([
              ...value.experience,
              {
                id: newId('exp'),
                company: '',
                role: '',
                start: '',
                end: null,
                bullets: [],
              },
            ])
          }
        />
      </Section>

      <Section title="Educación" description="Estudios formales y cursos con institución.">
        <div className="mt-3 space-y-4">
          {value.education.map((education, index) => (
            <Card
              key={`${education.institution}-${index}`}
              title={education.degree || `Estudio ${index + 1}`}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Título">
                  <input
                    value={education.degree}
                    onChange={(event) =>
                      setEducation(
                        value.education.map((item, position) =>
                          position === index ? { ...item, degree: event.target.value } : item,
                        ),
                      )
                    }
                    className={INPUT}
                  />
                </Field>
                <Field label="Institución">
                  <input
                    value={education.institution}
                    onChange={(event) =>
                      setEducation(
                        value.education.map((item, position) =>
                          position === index ? { ...item, institution: event.target.value } : item,
                        ),
                      )
                    }
                    className={INPUT}
                  />
                </Field>
                <Field label="Inicio (opcional)">
                  <input
                    value={education.start ?? ''}
                    onChange={(event) =>
                      setEducation(
                        value.education.map((item, position) =>
                          position === index
                            ? { ...item, start: optional(event.target.value) }
                            : item,
                        ),
                      )
                    }
                    className={INPUT}
                  />
                </Field>
                <Field label="Fin (opcional)">
                  <input
                    value={education.end ?? ''}
                    onChange={(event) =>
                      setEducation(
                        value.education.map((item, position) =>
                          position === index
                            ? { ...item, end: optional(event.target.value) }
                            : item,
                        ),
                      )
                    }
                    className={INPUT}
                  />
                </Field>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() =>
                    setEducation(value.education.filter((_, position) => position !== index))
                  }
                  className="text-xs font-medium text-rose-700 underline decoration-rose-300 underline-offset-2 hover:text-rose-900"
                >
                  Eliminar este estudio
                </button>
              </div>
            </Card>
          ))}
        </div>

        <AddButton
          label="Agregar estudio"
          onClick={() =>
            setEducation([...value.education, { institution: '', degree: '' } satisfies Education])
          }
        />
      </Section>

      <Section
        title="Skills"
        description="La validación rechaza cualquier skill que la IA invente y no esté en esta lista."
      >
        <div className="mt-3 space-y-3">
          {value.skills.map((skill, index) => (
            <div key={`${skill.name}-${index}`} className="grid gap-3 sm:grid-cols-[2fr_1fr_auto]">
              <Field label="Skill">
                <input
                  value={skill.name}
                  onChange={(event) =>
                    setSkills(
                      value.skills.map((item, position) =>
                        position === index ? { ...item, name: event.target.value } : item,
                      ),
                    )
                  }
                  placeholder="SQL"
                  className={INPUT}
                />
              </Field>
              <Field label="Categoría (opcional)">
                <input
                  value={skill.category ?? ''}
                  onChange={(event) =>
                    setSkills(
                      value.skills.map((item, position) =>
                        position === index
                          ? { ...item, category: optional(event.target.value) }
                          : item,
                      ),
                    )
                  }
                  placeholder="Datos"
                  className={INPUT}
                />
              </Field>
              <RemoveButton
                label={`Eliminar skill ${skill.name || index + 1}`}
                onClick={() => setSkills(value.skills.filter((_, position) => position !== index))}
              />
            </div>
          ))}
        </div>
        <AddButton
          label="Agregar skill"
          onClick={() => setSkills([...value.skills, { name: '' } satisfies Skill])}
        />
      </Section>

      <Section
        title="Tecnologías familiares"
        description="Cosas que tocaste pero no dominás. Se usan solo como base para una skill afín, nunca como experiencia propia."
      >
        <CommaListField
          label="Tecnologías (separadas por coma)"
          value={value.familiarSkills ?? []}
          onChange={(familiarSkills) => onChange({ ...value, familiarSkills })}
        />
      </Section>

      <Section title="Proyectos" description="Proyectos propios o freelance que sumen al CV.">
        <div className="mt-3 space-y-4">
          {value.projects.map((project, index) => (
            <Card key={project.id} title={project.name || `Proyecto ${index + 1}`}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nombre">
                  <input
                    value={project.name}
                    onChange={(event) =>
                      setProjects(
                        value.projects.map((item, position) =>
                          position === index ? { ...item, name: event.target.value } : item,
                        ),
                      )
                    }
                    className={INPUT}
                  />
                </Field>
                <Field label="URL (opcional)">
                  <input
                    value={project.url ?? ''}
                    onChange={(event) =>
                      setProjects(
                        value.projects.map((item, position) =>
                          position === index
                            ? { ...item, url: optional(event.target.value) }
                            : item,
                        ),
                      )
                    }
                    className={INPUT}
                  />
                </Field>
              </div>
              <Field label="Descripción">
                <textarea
                  value={project.description}
                  onChange={(event) =>
                    setProjects(
                      value.projects.map((item, position) =>
                        position === index ? { ...item, description: event.target.value } : item,
                      ),
                    )
                  }
                  rows={3}
                  className={INPUT}
                />
              </Field>
              <CommaListField
                key={project.id}
                label="Tecnologías (separadas por coma)"
                value={project.tech}
                onChange={(tech) =>
                  setProjects(
                    value.projects.map((item, position) =>
                      position === index ? { ...item, tech } : item,
                    ),
                  )
                }
              />
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() =>
                    setProjects(value.projects.filter((_, position) => position !== index))
                  }
                  className="text-xs font-medium text-rose-700 underline decoration-rose-300 underline-offset-2 hover:text-rose-900"
                >
                  Eliminar este proyecto
                </button>
              </div>
            </Card>
          ))}
        </div>
        <AddButton
          label="Agregar proyecto"
          onClick={() =>
            setProjects([
              ...value.projects,
              { id: newId('project'), name: '', description: '', tech: [] } satisfies Project,
            ])
          }
        />
      </Section>

      <Section title="Certificaciones" description="Cursos y certificados con emisor y año.">
        <div className="mt-3 space-y-3">
          {value.certifications.map((certification, index) => (
            <div
              key={`${certification.name}-${index}`}
              className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]"
            >
              <Field label="Nombre">
                <input
                  value={certification.name}
                  onChange={(event) =>
                    setCertifications(
                      value.certifications.map((item, position) =>
                        position === index ? { ...item, name: event.target.value } : item,
                      ),
                    )
                  }
                  className={INPUT}
                />
              </Field>
              <Field label="Emisor (opcional)">
                <input
                  value={certification.issuer ?? ''}
                  onChange={(event) =>
                    setCertifications(
                      value.certifications.map((item, position) =>
                        position === index
                          ? { ...item, issuer: optional(event.target.value) }
                          : item,
                      ),
                    )
                  }
                  className={INPUT}
                />
              </Field>
              <Field label="Año (opcional)">
                <input
                  value={certification.year ?? ''}
                  onChange={(event) =>
                    setCertifications(
                      value.certifications.map((item, position) =>
                        position === index ? { ...item, year: optional(event.target.value) } : item,
                      ),
                    )
                  }
                  className={INPUT}
                />
              </Field>
              <RemoveButton
                label={`Eliminar certificación ${certification.name || index + 1}`}
                onClick={() =>
                  setCertifications(
                    value.certifications.filter((_, position) => position !== index),
                  )
                }
              />
            </div>
          ))}
        </div>
        <AddButton
          label="Agregar certificación"
          onClick={() =>
            setCertifications([...value.certifications, { name: '' } satisfies Certification])
          }
        />
      </Section>

      <Section title="Idiomas" description="Idioma y nivel declarado.">
        <div className="mt-3 space-y-3">
          {value.languages.map((language, index) => (
            <div
              key={`${language.name}-${index}`}
              className="grid gap-3 sm:grid-cols-[2fr_2fr_auto]"
            >
              <Field label="Idioma">
                <input
                  value={language.name}
                  onChange={(event) =>
                    setLanguages(
                      value.languages.map((item, position) =>
                        position === index ? { ...item, name: event.target.value } : item,
                      ),
                    )
                  }
                  placeholder="Inglés"
                  className={INPUT}
                />
              </Field>
              <Field label="Nivel (opcional)">
                <input
                  value={language.level ?? ''}
                  onChange={(event) =>
                    setLanguages(
                      value.languages.map((item, position) =>
                        position === index
                          ? { ...item, level: optional(event.target.value) }
                          : item,
                      ),
                    )
                  }
                  placeholder="B2"
                  className={INPUT}
                />
              </Field>
              <RemoveButton
                label={`Eliminar idioma ${language.name || index + 1}`}
                onClick={() =>
                  setLanguages(value.languages.filter((_, position) => position !== index))
                }
              />
            </div>
          ))}
        </div>
        <AddButton
          label="Agregar idioma"
          onClick={() => setLanguages([...value.languages, { name: '' } satisfies Language])}
        />
      </Section>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-5">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      {children}
    </section>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="mb-3 text-sm font-semibold text-slate-900">{title}</p>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: el control llega como children y siempre es un input o textarea
    <label className="block">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function ListHeader({
  title,
  onAdd,
  addLabel,
}: {
  title: string;
  onAdd: () => void;
  addLabel: string;
}) {
  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <button
        type="button"
        onClick={onAdd}
        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
      >
        {addLabel}
      </button>
    </div>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
    >
      + {label}
    </button>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="mt-1 self-end rounded-lg border border-rose-200 bg-white px-2 py-2 text-xs font-medium text-rose-700 transition hover:bg-rose-50 sm:mt-6"
    >
      Eliminar
    </button>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="mt-3 rounded-lg bg-white p-3 text-xs text-slate-500">{text}</p>;
}

function CommaListField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [text, setText] = useState(() => value.join(', '));

  // Si el valor cambia desde afuera (por ejemplo, al generar el perfil), se
  // refleja acá. Mientras se escribe, el texto local manda para no perder comas.
  useEffect(() => {
    const current = parseList(text);

    if (!sameList(current, value)) {
      setText(value.join(', '));
    }
  }, [text, value]);

  return (
    <Field label={label}>
      <input
        value={text}
        onChange={(event) => {
          const raw = event.target.value;
          setText(raw);
          onChange(parseList(raw));
        }}
        className={INPUT}
      />
    </Field>
  );
}

function parseList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function sameList(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function optional(value: string): string | undefined {
  return value.trim().length === 0 ? undefined : value;
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
