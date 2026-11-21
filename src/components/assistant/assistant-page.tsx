"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { useToday } from "@/components/modules/use-today";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAudit } from "@/components/audit/use-audit";
import { parseDirect, runDirect, type DirectAction, type DirectResult } from "@/lib/assistant/direct";
import { greeting, respond, type Link as ChatLink, type Turn } from "@/lib/assistant/engine";
import { starterForms } from "@/lib/forms/starter-forms";
import { useDashboardSources } from "@/lib/records/sources";
import { emptySources } from "@/lib/reporting/logic";
import { datasetToXlsx } from "@/lib/datasets/xlsx";
import { toCsv } from "@/lib/csv";
import { downloadBlob } from "@/components/reporting/materials";
import { saveReminders, useReminders } from "@/lib/reminders/storage";
import { newTodoId } from "@/lib/todos/logic";
import { saveTodos, useTodos } from "@/lib/todos/storage";
import { useSetupConfig } from "@/lib/setup/storage";
import { emptyConfig } from "@/lib/setup/types";
import { cn } from "@/lib/utils";

function Chat({ today }: { today: string }) {
  const stored = useSetupConfig();
  const todos = useTodos();
  const reminders = useReminders();
  const audit = useAudit();
  const live = useDashboardSources(today);
  /** Undo for the actions Addy took itself, by turn number; `undone` marks the ones already used. */
  const [undoers, setUndoers] = useState<Record<number, () => void>>({});
  const [undone, setUndone] = useState<Set<number>>(new Set());
  const [turns, setTurns] = useState<Turn[]>(() => [greeting(stored ?? emptyConfig())]);
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView?.({ block: "end" }); }, [turns]);

  const [busy, setBusy] = useState(false);
  /** null until the first message; false when the server has no AI key, so the built-in rules answer. */
  const [llm, setLlm] = useState<boolean | null>(null);

  const addRules = (input: string) => {
    setTurns((t) => [...t, ...respond(stored ?? emptyConfig(), input).turns]);
  };

  /** The few things Addy does itself (to-do, reminder, tick off). Handled here so they work whether or not the AI model is on. */
  const runLocally = (message: string, action: DirectAction) => {
    const r: DirectResult = runDirect(action, { todos, reminders, today, newId: newTodoId, sources: { ...emptySources(), ...live, forms: starterForms() } });
    if (r.todos) saveTodos(r.todos);
    if (r.reminders) saveReminders(r.reminders);
    if (r.todos || r.reminders) {
      if (action.kind === "todo") audit("asked Addy to add", `"${action.title}" to today's to-do list`, "Tasks", "/app/overview");
      else if (action.kind === "remind") audit("asked Addy to set a reminder:", action.title, "Tasks", "/app/calendar");
      else if (action.kind === "done") audit("asked Addy to tick off", action.query, "Tasks", "/app/overview");
    }
    const at = turns.length + 1; // the user's message comes first, then this reply
    const back = r.undo;
    if (back) {
      setUndoers((u) => ({
        ...u,
        [at]: () => {
          if (back.todos) saveTodos(back.todos);
          if (back.reminders) saveReminders(back.reminders);
          setUndone((s) => new Set(s).add(at));
        },
      }));
    }
    setTurns((t) => [...t, { role: "user", text: message }, { role: "assistant", text: r.text, links: r.link ? [r.link] : undefined, download: r.download }]);
  };

  const send = async (input: string) => {
    const message = input.trim();
    if (!message || busy) return;
    setText("");
    const direct = parseDirect(message);
    if (direct) { runLocally(message, direct); return; }
    if (llm === false) { addRules(message); return; }

    const next: Turn[] = [...turns, { role: "user", text: message }];
    setTurns(next);
    setBusy(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next.map((t) => ({ role: t.role, content: t.text })), config: stored ?? emptyConfig(), today }),
      });
      if (res.status === 501) {
        setLlm(false);
        setTurns(turns);
        addRules(message);
        return;
      }
      const body = (await res.json().catch(() => null)) as { ok: boolean; data?: { text: string; links: ChatLink[] }; error?: { message: string } } | null;
      if (!res.ok || !body?.ok || !body.data) {
        setTurns([...next, { role: "assistant", text: body?.error?.message ?? "Something went wrong. Please try again." }]);
        return;
      }
      setLlm(true);
      setTurns([...next, { role: "assistant", text: body.data.text, links: body.data.links }]);
    } catch {
      setTurns([...next, { role: "assistant", text: "I could not reach the server. Check your connection and try again." }]);
    } finally {
      setBusy(false);
    }
  };
  const last = turns[turns.length - 1];
  const fresh = turns.length === 1;
  const reset = () => { setTurns([greeting(stored ?? emptyConfig())]); setUndoers({}); setUndone(new Set()); setText(""); };

  return (
    <section aria-label="Conversation with Addy" className="flex flex-col rounded-2xl border bg-card shadow-panel">
      <ol aria-live="polite" aria-label="Conversation" className="max-h-[60vh] min-h-72 space-y-3 overflow-y-auto p-4" data-testid="assistant-log">
        {turns.map((t, i) => (
          <li key={i} className={cn("flex", t.role === "user" && "justify-end")}>
            <div className={cn("max-w-[85%] space-y-2 rounded-2xl px-4 py-2.5 text-sm", t.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted")}>
              <p className="whitespace-pre-line">{t.text}</p>
              {undoers[i] && (
                undone.has(i)
                  ? <p className="text-xs text-muted-foreground" data-testid="undone">Undone.</p>
                  : <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => undoers[i]?.()}>Undo</Button>
              )}
              {t.download && (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => downloadBlob(toCsv([t.download!.headers, ...t.download!.rows]), `${t.download!.name}.csv`, "text/csv")}>Save as CSV</Button>
                  <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => downloadBlob(datasetToXlsx({ name: t.download!.name, columns: t.download!.headers.map((name) => ({ name, type: "text" as const, required: false })), rows: t.download!.rows }), `${t.download!.name}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}>Save as Excel</Button>
                </div>
              )}
              {t.links && t.links.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {t.links.map((l) => <li key={l.href}><Link href={l.href} className="inline-flex h-8 items-center rounded-lg border bg-card px-2.5 text-xs font-medium text-foreground hover:bg-accent">{l.label}</Link></li>)}
                </ul>
              )}
            </div>
          </li>
        ))}
        {busy && <li className="text-xs text-muted-foreground" role="status">Thinking…</li>}
        <div ref={end} />
      </ol>
      <div className="space-y-3 border-t p-4">
        {fresh && (
          <ul className="flex flex-wrap gap-2" aria-label="Things to try">
            {["Add a license renewal", "What is due this week?", "Draft an invoice"].map((c) => (
              <li key={c}><button type="button" onClick={() => void send(c)} className="h-8 rounded-full border bg-card px-3 text-xs font-medium text-primary outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">{c}</button></li>
            ))}
          </ul>
        )}
        {last?.role === "assistant" && last.chips && (
          <ul className="flex flex-wrap gap-2" aria-label="Suggested replies">
            {last.chips.map((c) => <li key={c}><button type="button" onClick={() => void send(c)} className="h-8 rounded-full border bg-card px-3 text-xs font-medium text-primary outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">{c}</button></li>)}
          </ul>
        )}
        <form onSubmit={(e) => { e.preventDefault(); void send(text); }} className="flex gap-2">
          <Input aria-label="Message Addy" value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} placeholder="Type a message" />
          <Button type="submit" disabled={!text.trim() || busy}><Send /> <span className="sr-only sm:not-sr-only">Send</span></Button>
        </form>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span data-testid="assistant-mode">{llm === null ? "Addy answers with built-in rules unless the AI model is switched on for your plan." : llm ? "Answering with the AI model." : "Answering with built-in rules."}</span>
          {!fresh && <button type="button" onClick={reset} className="rounded font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">New chat</button>}
        </div>
      </div>
    </section>
  );
}

/** Q&A and in-module assistant. Uses Claude through /api/assistant when an API key is set; otherwise the built-in rules answer. Neither changes account setup: that stays manual in Settings. */
export function AssistantPage() {
  const today = useToday();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><Sparkles className="size-6 text-primary" aria-hidden /> Addy</h1>
        <p className="text-sm text-muted-foreground">Addy answers questions about AdFlo and your records, and prepares drafts in your services for you to review. You set up your account yourself in Settings.</p>
      </div>
      {today ? <Chat today={today} /> : <Skeleton className="h-96 rounded-2xl" aria-busy="true" />}
    </div>
  );
}
