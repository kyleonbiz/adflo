"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addDays } from "@/lib/dates";
import { PROJECT_STATUSES, type Project } from "@/lib/projects/types";
import { projectFormSchema, type ProjectFormInput, type ProjectFormValues } from "@/lib/projects/validation";

function defaults(project: Project | undefined, today: string): ProjectFormInput {
  if (project) {
    return {
      name: project.name, client: project.client, description: project.description,
      status: project.status, startOn: project.startOn, dueOn: project.dueOn,
    };
  }
  return { name: "", client: "", description: "", status: "planning", startOn: today, dueOn: addDays(today, 30) };
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
  open, project, today, onOpenChange, onSubmit,
}: {
  open: boolean;
  project?: Project;
  today: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ProjectFormValues) => void;
}) {
  const { register, control, handleSubmit, reset, formState } = useForm<ProjectFormInput, unknown, ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: defaults(project, today),
  });
  const { errors } = formState;

  useEffect(() => {
    if (open) reset(defaults(project, today));
  }, [open, project, today, reset]);

  const submit = handleSubmit((values) => {
    onSubmit(values);
    onOpenChange(false);
  });
  const invalid = (name: keyof ProjectFormInput) => ({
    "aria-invalid": !!errors[name],
    "aria-describedby": errors[name] ? `proj-${name}-error` : undefined,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <div className="border-b px-5 py-4 pr-14">
          <DialogTitle>{project ? "Edit project" : "New project"}</DialogTitle>
          <DialogDescription className="mt-1">Add tasks after the project is created.</DialogDescription>
        </div>
        <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="grid flex-1 gap-4 overflow-y-auto px-5 py-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field id="proj-name" label="Project name" error={errors.name?.message}>
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
            <Field id="proj-startOn" label="Starts on" error={errors.startOn?.message}>
              <Input id="proj-startOn" type="date" {...invalid("startOn")} {...register("startOn")} />
            </Field>
            <Field id="proj-dueOn" label="Due on" error={errors.dueOn?.message}>
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
          </div>
          <div className="flex justify-end gap-2 border-t px-5 py-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">{project ? "Save changes" : "Create project"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
