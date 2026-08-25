"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Check, Send } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button, buttonClasses } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { EmptyState, ErrorNote, Skeleton } from "@/components/ui/states";
import { useSession } from "@/components/session";
import { cn } from "@/lib/utils";
import { ghs, idempotencyKey } from "@/lib/format";
import {
  ApiError,
  distributeFloat,
  getMe,
  getSubAgents,
  recallFloat,
  type Direction,
  type FloatDistribution,
  type SubAgent,
} from "@/lib/superagent-api";

type Phase = "form" | "confirm" | "done";

/**
 * The float movement form.
 *
 * Two decisions shape it. First, a confirmation step: this is the one screen in the portal that
 * moves money, and the resulting balances are shown before the operator commits rather than
 * after. Second, the idempotency key is minted once when they reach that step and reused for
 * every retry of the same movement — so a double-click, a flaky connection or an impatient
 * second press settles once. Going back to edit starts a genuinely new movement, and mints a
 * new key.
 */
/**
 * `useSearchParams` opts the tree into client-side rendering, so the boundary lives here and
 * the form itself stays a plain component.
 */
export default function DistributePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-xl space-y-4">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-80 w-full" />
        </div>
      }
    >
      <MoveFloatForm />
    </Suspense>
  );
}

function MoveFloatForm() {
  const { refresh } = useSession();
  const searchParams = useSearchParams();
  const [agents, setAgents] = useState<SubAgent[]>([]);
  const [masterFloat, setMasterFloat] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const [direction, setDirection] = useState<Direction>("DISTRIBUTE");
  const [agentId, setAgentId] = useState("");
  const [amountText, setAmountText] = useState("");
  const [note, setNote] = useState("");

  const [phase, setPhase] = useState<Phase>("form");
  const [passcode, setPasscode] = useState("");
  const [key, setKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FloatDistribution | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getSubAgents("ACTIVE"), getMe()])
      .then(([list, me]) => {
        if (cancelled) return;
        setAgents(list);
        setMasterFloat(me.floatBalance ?? 0);
        // Arriving from an agent's page means the operator already picked one. Only honour it
        // if they are actually in the active roster, so a stale or hand-typed id selects nothing.
        const requested = searchParams.get("agent");
        if (requested && list.some((a) => a.id === requested)) {
          setAgentId(requested);
        }
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const agent = useMemo(() => agents.find((a) => a.id === agentId) ?? null, [agents, agentId]);
  const amount = useMemo(() => {
    const parsed = Number.parseFloat(amountText);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [amountText]);

  const sendingDown = direction === "DISTRIBUTE";
  const sourceBalance = sendingDown ? (masterFloat ?? 0) : (agent?.floatBalance ?? 0);

  // Client-side checks mirror the backend's, purely so the operator hears about a problem before
  // they commit. The backend is still the authority on every one of them.
  const problem = useMemo(() => {
    if (!agent) return "Choose an agent.";
    if (!amountText.trim()) return null;
    if (!Number.isFinite(amount) || amount <= 0) return "Enter an amount greater than zero.";
    if (/\.\d{3,}$/.test(amountText.trim())) return "Amounts go to the pesewa — two decimal places.";
    if (amount > sourceBalance)
      return sendingDown
        ? "That's more float than you have available."
        : "That's more float than the agent is holding.";
    const ceiling = sendingDown ? agent.floatLimit : null;
    if (ceiling != null && agent.floatBalance + amount > ceiling)
      return `That would push them past their ${ghs(ceiling)} float limit.`;
    return null;
  }, [agent, amount, amountText, sendingDown, sourceBalance]);

  const ready = agent != null && amount > 0 && problem == null;

  function review() {
    if (!ready) return;
    // Minted once, here — every retry of this movement carries the same key, so a timeout the
    // operator re-submits settles once. Going back to edit mints a new one.
    setKey(idempotencyKey());
    setPasscode("");
    setError(null);
    setPhase("confirm");
  }

  async function commit() {
    if (!agent || !key) return;
    setBusy(true);
    setError(null);
    try {
      const payload = {
        subAgentId: agent.id,
        amount,
        note: note.trim() || undefined,
        idempotencyKey: key,
        passcode,
      };
      const movement = sendingDown ? await distributeFloat(payload) : await recallFloat(payload);
      setResult(movement);
      setMasterFloat(movement.superAgentFloatBalance);
      // The single-movement response always carries both balances; the fallback is only here
      // because the listing shape shares this type and leaves them null.
      setAgents((prev) =>
        prev.map((a) =>
          a.id === agent.id
            ? { ...a, floatBalance: movement.subAgentFloatBalance ?? a.floatBalance }
            : a
        )
      );
      setPasscode("");
      setPhase("done");
      // The header carries the master's float; it is now a movement out of date.
      void refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That movement didn't go through.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setPhase("form");
    setKey(null);
    setResult(null);
    setAmountText("");
    setNote("");
    setPasscode("");
    setError(null);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="mx-auto max-w-xl">
        <Card>
          <EmptyState
            title="No active agents yet"
            description="Float can only move to an agent in your network who has been approved. Add one to get started."
            action={
              <Link href="/agents/invite" className={buttonClasses({ size: "sm" })}>
                Add an agent
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Move float</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Send float down to an agent, or pull it back up.
        </p>
      </div>

      {phase === "done" && result ? (
        <Card className="animate-rise">
          <CardBody className="text-center">
            <span className="mx-auto grid size-11 place-items-center rounded-full bg-primary/15">
              <Check className="size-5 text-primary" aria-hidden />
            </span>
            <p className="mt-4 text-sm text-muted-foreground">
              {result.direction === "DISTRIBUTE" ? "Sent to" : "Recalled from"}{" "}
              <span className="font-medium text-foreground">
                {result.subAgentName ?? result.subAgentCode}
              </span>
            </p>
            <p className="tnum mt-1 text-3xl font-semibold tracking-tight text-primary">
              {ghs(result.amount)}
            </p>

            <dl className="mt-6 grid grid-cols-2 gap-3 text-left">
              <div className="rounded-lg border border-border px-4 py-3">
                <dt className="text-xs text-muted-foreground">Your float</dt>
                <dd className="tnum mt-0.5 text-sm font-semibold">
                  {ghs(result.superAgentFloatBalance)}
                </dd>
              </div>
              <div className="rounded-lg border border-border px-4 py-3">
                <dt className="text-xs text-muted-foreground">Their float</dt>
                <dd className="tnum mt-0.5 text-sm font-semibold">
                  {ghs(result.subAgentFloatBalance)}
                </dd>
              </div>
            </dl>

            <div className="mt-6 flex justify-center gap-2">
              <Button onClick={reset}>Move more float</Button>
              <Link href="/distributions" className={buttonClasses({ variant: "outline" })}>
                View ledger
              </Link>
            </div>
          </CardBody>
        </Card>
      ) : phase === "confirm" && agent ? (
        <Card className="animate-rise">
          <CardHeader
            title="Confirm this movement"
            description="Check the figures — this settles immediately."
          />
          <CardBody className="space-y-5">
            {error ? <ErrorNote message={error} /> : null}

            <p className="tnum text-center text-3xl font-semibold tracking-tight">{ghs(amount)}</p>
            <p className="text-center text-sm text-muted-foreground">
              {sendingDown ? "to" : "from"}{" "}
              <span className="font-medium text-foreground">
                {agent.userName ?? agent.businessName}
              </span>{" "}
              <span className="tnum">({agent.code})</span>
            </p>

            <dl className="grid grid-cols-2 gap-3">
              <BalanceChange
                label="Your float"
                before={masterFloat ?? 0}
                after={(masterFloat ?? 0) + (sendingDown ? -amount : amount)}
              />
              <BalanceChange
                label="Their float"
                before={agent.floatBalance}
                after={agent.floatBalance + (sendingDown ? amount : -amount)}
              />
            </dl>

            <p className="rounded-md border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
              No fee is charged and no commission is taken — the full {ghs(amount)} lands in the
              other float.
            </p>

            <Field label="Your passcode" htmlFor="passcode">
              <Input
                id="passcode"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={4}
                autoFocus
                value={passcode}
                onChange={(e) => setPasscode(e.target.value.replace(/\D/g, ""))}
                placeholder="••••"
                className="tnum tracking-[0.5em]"
              />
            </Field>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setPhase("form")} disabled={busy}>
                Back
              </Button>
              <Button
                className="flex-1"
                onClick={commit}
                loading={busy}
                disabled={passcode.length !== 4}
              >
                {sendingDown ? "Send float" : "Recall float"}
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody className="space-y-5">
            {error ? <ErrorNote message={error} /> : null}

            {/* Direction. A segmented control rather than a dropdown: it changes what every
                figure below means, so it should never be one click away from being missed. */}
            {/* A group of two toggles, not a radiogroup: a real radiogroup owes the user
                arrow-key navigation between options, and claiming the role without it is
                worse for a screen reader than not claiming it. Tab reaches both buttons. */}
            <div
              role="group"
              aria-label="Direction"
              className="grid grid-cols-2 gap-2 rounded-lg border border-border p-1"
            >
              {(
                [
                  { value: "DISTRIBUTE", label: "Send down", icon: ArrowDown },
                  { value: "RECALL", label: "Recall", icon: ArrowUp },
                ] as const
              ).map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={direction === value}
                  onClick={() => setDirection(value)}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    direction === value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {label}
                </button>
              ))}
            </div>

            <Field label="Agent" htmlFor="agent">
              <Select id="agent" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
                <option value="">Choose an agent…</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {(a.userName ?? a.businessName ?? "Agent") + " — " + (a.code ?? "no code")}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Amount"
              htmlFor="amount"
              error={amountText.trim() && problem && agent ? problem : null}
              hint={
                agent
                  ? sendingDown
                    ? `You have ${ghs(masterFloat)} available`
                    : `They're holding ${ghs(agent.floatBalance)}`
                  : "Choose an agent to see the balances"
              }
            >
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-sm text-muted-foreground">
                  GHS
                </span>
                <Input
                  id="amount"
                  inputMode="decimal"
                  value={amountText}
                  onChange={(e) => setAmountText(e.target.value.replace(/[^\d.]/g, ""))}
                  placeholder="0.00"
                  className="tnum pl-12 text-base"
                />
              </div>
            </Field>

            <Field label="Note" htmlFor="note" hint="Optional — shows on the ledger entry.">
              <Textarea
                id="note"
                value={note}
                maxLength={500}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Morning top-up"
              />
            </Field>

            <Button size="lg" className="w-full" disabled={!ready} onClick={review}>
              <Send aria-hidden />
              Review
            </Button>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

/** Before → after for one wallet, so the consequence of the movement is legible at a glance. */
function BalanceChange({ label, before, after }: { label: string; before: number; after: number }) {
  const up = after > before;
  return (
    <div className="rounded-lg border border-border px-4 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1">
        <span className="tnum text-xs text-muted-foreground line-through">{ghs(before)}</span>
        <span className={cn("tnum ml-2 text-sm font-semibold", up ? "text-primary" : "text-foreground")}>
          {ghs(after)}
        </span>
      </dd>
    </div>
  );
}
