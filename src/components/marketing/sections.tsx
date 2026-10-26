import Link from "next/link";
import { ArrowRight, Eye, FileLock2, FolderCheck, ShieldCheck } from "lucide-react";
import { MODULE_ICONS } from "@/components/modules/module-icons";
import { MODULES, moduleHref } from "@/lib/modules/registry";

const COUNT_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];

export function ModuleGrid() {
  const modules = MODULES.filter((m) => moduleHref(m, "/demo"));
  const count = COUNT_WORDS[modules.length] ?? String(modules.length);
  return (
    <section id="modules" aria-labelledby="modules-title" className="scroll-mt-6 px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <h2 id="modules-title" className="text-center text-3xl font-semibold tracking-tight">
          {count[0].toUpperCase() + count.slice(1)} modules, one place
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
          Switch on only what you need. Every module opens in the demo, so you can click through it before you decide.
        </p>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((m) => {
            const Icon = MODULE_ICONS[m.id];
            return (
              <li key={m.id}>
                <Link
                  href={moduleHref(m, "/demo")!}
                  data-testid="module-card"
                  className="group flex h-full flex-col rounded-2xl border bg-card p-5 shadow-panel outline-none transition-shadow hover:shadow-float focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-primary">{Icon && <Icon className="size-5" aria-hidden />}</span>
                  <span className="mt-4 text-base font-semibold">{m.name}</span>
                  <span className="mt-1 flex-1 text-sm text-muted-foreground">{m.summary}</span>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                    Try it <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

const STEPS = [
  { title: "Tell us about your business", body: "A five-step setup recommends modules for your industry and installs ready-made forms, recurring tasks and license records." },
  { title: "Bring in what you already have", body: "Import contact lists and spreadsheets, or scan a messy folder. Every problem row is explained before anything changes." },
  { title: "Let the routines run", body: "Renewal dates, due invoices and recurring tasks surface on their own, and anything risky waits for a person to approve it." },
];

export function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-title" className="scroll-mt-6 border-y border-indigo-100 bg-white/60 px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <h2 id="how-title" className="text-center text-3xl font-semibold tracking-tight">Up and running in three steps</h2>
        <ol className="mt-10 grid gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative rounded-2xl border bg-card p-5 shadow-panel" data-testid="how-step">
              <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{i + 1}</span>
              <h3 className="mt-3 text-base font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const PRINCIPLES = [
  { icon: FolderCheck, title: "Nothing moves without your say-so", body: "The file cleanup shows every change with its reason, waits for your approval, and only ever moves and renames. It never deletes." },
  { icon: FileLock2, title: "Your files stay on your computer", body: "Folders and spreadsheets are read in your browser to compare them. They are not uploaded." },
  { icon: ShieldCheck, title: "People approve the risky things", body: "Wire transfers, deletions, access changes and contracts wait for a person to say yes before any work starts." },
  { icon: Eye, title: "Clear, explainable data", body: "Imports name the exact line and reason for every rejected row, and exports are protected against spreadsheet formula tricks." },
];

export function Principles() {
  return (
    <section aria-labelledby="careful-title" className="px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <h2 id="careful-title" className="text-center text-3xl font-semibold tracking-tight">Careful by design</h2>
        <ul className="mt-10 grid gap-5 sm:grid-cols-2">
          {PRINCIPLES.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-4" data-testid="principle">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary"><Icon className="size-5" aria-hidden /></span>
              <span>
                <span className="block text-base font-semibold">{title}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{body}</span>
              </span>
            </li>
          ))}
        </ul>
        <p role="note" className="mx-auto mt-10 max-w-2xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-900" data-testid="preview-note">
          This is a preview. The demos run on sample data and nothing is saved yet. Accounts, saving and email reminders arrive when the database is connected.
        </p>
      </div>
    </section>
  );
}
