"use client";

import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addDays, isDay } from "@/lib/dates";
import { PROJECT_TEMPLATES, templateDueOn, type ProjectTemplate, type TemplateTask } from "@/lib/projects/templates";
import { PROJECT_STATUSES, type Project } from "@/lib/projects/types";
import { projectFormSchema, type ProjectFormInput, type ProjectFormValues } from "@/lib/projects/validation";
import { NEW_TYPE, buildCustomType, isCustomType, type CustomTypeInput } from "@/lib/projects/custom-types";
import { industryProjects } from "@/lib/setup/industries";
import { useSetupConfig } from "@/lib/setup/storage";
import { saveCustomTypes, useCustomTypes } from "@/lib/projects/custom-types-storage";

const newTypeId = () => Math.random().toString(36).slice(2, 10);

/** Details an assistant draft can start a project with. */
export interface ProjectDraft { name?: string; client?: string; description?: string; dueOn?: string }

function defaults(project: Project | undefined, today: string, draft?: ProjectDraft): ProjectFormInput {
  if (project) {
    return {
      name: project.name, client: project.client, description: project.description,
      status: project.status, startOn: project.startOn, dueOn: project.dueOn,
      owner: project.owner ?? "", linkKind: project.linked?.kind ?? "none", linkName: project.linked?.name ?? "",
    };
  }
  return { name: draft?.name ?? "", client: draft?.client ?? "", description: draft?.description ?? "", status: "planning", startOn: today, dueOn: draft?.dueOn ?? addDays(today, 30), owner: "", linkKind: "none", linkName: "" };
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p id={`${id}-error`} role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/** Create or edit a project. `project` present means edit. */
export function ProjectFormDialog({
  open, project, draft, today, onOpenChange, onSubmit,
}: {
  open: boolean;
  project?: Project;
  draft?: ProjectDraft;
  today: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ProjectFormValues, tasks: TemplateTask[]) => void;
}) {
  const [templateId, setTemplateId] = useState("blank");
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const custom = useCustomTypes();
  const setup = useSetupConfig();
  const forYou = industryProjects(setup);
  const all: ProjectTemplate[] = [...forYou, ...PROJECT_TEMPLATES.filter((t) => !forYou.some((f) => f.id === t.id)), ...custom];
  const templateById = (id: string) => all.find((t) => t.id === id);
  const template = templateById(templateId);
  const [adding, setAdding] = useState<CustomTypeInput | null>(null);
  const [addError, setAddError] = useState("");
  const { register, control, handleSubmit, reset, formState, getValues, setValue } = useForm<ProjectFormInput, unknown, ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: defaults(project, today, draft),
  });
  const { errors } = formState;
  const linkKind = useWatch({ control, name: "linkKind" });

  useEffect(() => {
    if (open) reset(defaults(project, today, draft));
  }, [open, project, draft, today, reset]);

  // Every way of closing the dialog (cancel, escape, save) comes through here, so the next open starts blank.
  const setOpen = (next: boolean) => {
    if (!next) {
      setTemplateId("blank");
      setSkipped(new Set());
      setAdding(null);
    }
    onOpenChange(next);
  };

  const pickTemplate = (id: string) => {
    if (id === NEW_TYPE) { setAdding({ name: "", summary: "", durationDays: "30", tasks: "" }); setAddError(""); return; }
    setAdding(null);
    const previous = templateById(templateId);
    setTemplateId(id);
    setSkipped(new Set());
    const next = templateById(id);
    if (!next) return;
    // Keep anything the person typed themselves; only replace what a template filled in.
    const { name, description, startOn } = getValues();
    if (!name.trim() || name === previous?.name) setValue("name", next.name, { shouldDirty: true });
    if (!description.trim() || description === previous?.description) setValue("description", next.description, { shouldDirty: true });
    setValue("dueOn", templateDueOn(next, isDay(startOn) ? startOn : today), { shouldDirty: true });
  };

  const saveType = () => {
    if (!adding) return;
    const result = buildCustomType(adding, newTypeId(), all);
    if ("error" in result) { setAddError(result.error); return; }
    saveCustomTypes([...custom, result.type]);
    setAdding(null);
    setAddError("");
    // The new type is not in this render's list yet, so apply it directly.
    setTemplateId(result.type.id);
    setSkipped(new Set());
    const { name, description, startOn } = getValues();
    if (!name.trim()) setValue("name", result.type.name, { shouldDirty: true });
    if (!description.trim()) setValue("description", result.type.description, { shouldDirty: true });
    setValue("dueOn", templateDueOn(result.type, isDay(startOn) ? startOn : today), { shouldDirty: true });
  };

  const submit = handleSubmit((values) => {
    onSubmit(values, template ? template.tasks.filter((_, i) => !skipped.has(i)) : []);
    setOpen(false);
  });
  const invalid = (name: keyof ProjectFormInput) => ({
    "aria-invalid": !!errors[name],
    "aria-describedby": errors[name] ? `proj-${name}-error` : undefined,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-xl">
        <div className="border-b px-5 py-4 pr-14">
          <DialogTitle>{project ? "Edit project" : "New project"}</DialogTitle>
          <DialogDescription className="mt-1">
            {project ? "Update the project details." : "Start from a template to get a ready-made checklist, or begin blank and add tasks later."}
          </DialogDescription>
        </div>
        <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="grid flex-1 gap-4 overflow-y-auto px-5 py-4 sm:grid-cols-2">
            {!project && (
              <div className="sm:col-span-2">
                <Field id="proj-template" label="Start From A Template">
                  <Select value={templateId} onValueChange={pickTemplate}>
                    <SelectTrigger id="proj-template"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="blank">Blank Project</SelectItem>
                      {all.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                      <SelectItem value={NEW_TYPE}>+ Add your own project type</SelectItem>
                    </SelectContent>
                  </Select>
                  {template && !adding && <p className="text-xs text-muted-foreground">{template.summary}</p>}
                  {template && isCustomType(template.id) && !adding && (
                    <button
                      type="button"
                      className="text-xs font-medium text-destructive underline-offset-2 hover:underline"
                      onClick={() => { saveCustomTypes(custom.filter((t) => t.id !== template.id)); setTemplateId("blank"); setSkipped(new Set()); }}
                    >
                      Remove this project type
                    </button>
                  )}
                </Field>
              </div>
            )}
            {!project && adding && (
              <fieldset className="space-y-3 rounded-xl border bg-muted/30 p-3 sm:col-span-2">
                <legend className="px-1 text-sm font-medium">New project type</legend>
                <Field id="type-name" label="Type name">
                  <Input id="type-name" autoComplete="off" value={adding.name} onChange={(e) => setAdding({ ...adding, name: e.target.value })} />
                </Field>
                <Field id="type-summary" label="What it is for">
                  <Input id="type-summary" autoComplete="off" value={adding.summary} onChange={(e) => setAdding({ ...adding, summary: e.target.value })} />
                </Field>
                <Field id="type-days" label="Typical length (days)">
                  <Input id="type-days" inputMode="numeric" value={adding.durationDays} onChange={(e) => setAdding({ ...adding, durationDays: e.target.value })} />
                </Field>
                <Field id="type-tasks" label="Tasks (one per line)">
                  <textarea
                    id="type-tasks" rows={4} value={adding.tasks} onChange={(e) => setAdding({ ...adding, tasks: e.target.value })}
                    className="flex w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-xs focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                  />
                </Field>
                {addError && <p role="alert" className="text-xs text-destructive">{addError}</p>}
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={saveType}>Save project type</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => { setAdding(null); setAddError(""); }}>Cancel</Button>
                </div>
              </fieldset>
            )}
            <div className="sm:col-span-2">
              <Field id="proj-name" label="Project Name" error={errors.name?.message}>
                <Input id="proj-name" autoComplete="off" {...invalid("name")} {...register("name")} />
              </Field>
            </div>
            <Field id="proj-client" label="Client" error={errors.client?.message}>
              <Input id="proj-client" autoComplete="off" {...invalid("client")} {...register("client")} />
            </Field>
            <Field id="proj-status" label="Status" error={errors.status?.message}>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="proj-status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PROJECT_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field id="proj-owner" label="Owner (optional)" error={errors.owner?.message}>
              <Input id="proj-owner" autoComplete="off" placeholder="Who is accountable" {...invalid("owner")} {...register("owner")} />
            </Field>
            <Field id="proj-linkKind" label="For a contact or vendor?" error={errors.linkKind?.message}>
              <Controller control={control} name="linkKind" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="proj-linkKind" aria-label="For a contact or vendor?"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Neither</SelectItem>
                    <SelectItem value="contact">A contact</SelectItem>
                    <SelectItem value="vendor">A vendor</SelectItem>
                  </SelectContent>
                </Select>
              )} />
            </Field>
            {linkKind !== "none" && (
              <div className="sm:col-span-2">
                <Field id="proj-linkName" label={linkKind === "vendor" ? "Vendor name" : "Contact name"} error={errors.linkName?.message}>
                  <Input id="proj-linkName" autoComplete="off" {...invalid("linkName")} {...register("linkName")} />
                </Field>
              </div>
            )}
            <Field id="proj-startOn" label="Starts On" error={errors.startOn?.message}>
              <Input id="proj-startOn" type="date" {...invalid("startOn")} {...register("startOn")} />
            </Field>
            <Field id="proj-dueOn" label="Due On" error={errors.dueOn?.message}>
              <Input id="proj-dueOn" type="date" {...invalid("dueOn")} {...register("dueOn")} />
            </Field>
            <div className="sm:col-span-2">
              <Field id="proj-description" label="Description" error={errors.description?.message}>
                <textarea
                  id="proj-description"
                  rows={3}
                  className="flex w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground aria-invalid:border-destructive focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                  {...invalid("description")}
                  {...register("description")}
                />
              </Field>
            </div>
            {!project && template && (
              <fieldset className="space-y-1.5 sm:col-span-2">
                <legend className="text-sm font-medium">
                  Checklist <span className="font-normal text-muted-foreground">{template.tasks.length - skipped.size} of {template.tasks.length} tasks will be added</span>
                </legend>
                <ul className="divide-y rounded-lg border">
                  {template.tasks.map((t, i) => (
                    <li key={t.title}>
                      <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50">
                        <input
                          type="checkbox"
                          checked={!skipped.has(i)}
                          onChange={(e) => setSkipped((prev) => { const n = new Set(prev); if (e.target.checked) n.delete(i); else n.add(i); return n; })}
                          className="size-4 shrink-0 rounded border-input accent-primary"
                        />
                        <span className="min-w-0 flex-1 break-words">{t.title}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {t.repeat && t.repeat !== "none" ? `${t.repeat} · ` : ""}day {t.offsetDays}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t px-5 py-3">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">{project ? "Save changes" : "Create project"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
