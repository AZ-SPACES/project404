"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Check, Info } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { ErrorNote } from "@/components/ui/states";
import { ApiError, inviteSubAgent, type SubAgent } from "@/lib/superagent-api";

/**
 * Adds an existing AZA user to the master's network.
 *
 * The form is explicit that this does not make anyone an agent: it files an application with
 * the parent already set, and AZA compliance still approves it. Saying so here saves the
 * operator from expecting a till code that will not arrive for a day.
 */
export default function InviteAgentPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    identifier: "",
    businessName: "",
    location: "",
    contactPhone: "",
    idNumber: "",
    applicationNotes: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<SubAgent | null>(null);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const agent = await inviteSubAgent({
        identifier: form.identifier.trim(),
        businessName: form.businessName.trim(),
        location: form.location.trim() || undefined,
        contactPhone: form.contactPhone.trim() || undefined,
        idNumber: form.idNumber.trim() || undefined,
        applicationNotes: form.applicationNotes.trim() || undefined,
      });
      setCreated(agent);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not add that agent.");
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <div className="mx-auto max-w-lg">
        <Card className="animate-rise">
          <CardBody className="text-center">
            <span className="mx-auto grid size-11 place-items-center rounded-full bg-primary/15">
              <Check className="size-5 text-primary" aria-hidden />
            </span>
            <h1 className="mt-4 text-lg font-semibold tracking-tight">Application filed</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {created.userName ?? created.businessName}
              </span>{" "}
              has been added to your network as a pending agent. AZA compliance reviews the
              application — once it&apos;s approved they get a till code and you can send them
              float.
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <Button onClick={() => router.push("/agents")}>Back to my agents</Button>
              <Button variant="outline" onClick={() => { setCreated(null); setForm({ identifier: "", businessName: "", location: "", contactPhone: "", idNumber: "", applicationNotes: "" }); }}>
                Add another
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link
        href="/agents"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        All agents
      </Link>

      <div>
        <h1 className="text-xl font-semibold tracking-tight">Add an agent</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bring an existing AZA user into your network.
        </p>
      </div>

      <Card>
        <CardHeader title="Their details" />
        <CardBody className="space-y-5">
          <p className="flex items-start gap-2 rounded-md border border-border bg-secondary/40 px-3 py-2.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            They need an AZA account with identity verification already complete. You&apos;re
            filing their application — AZA compliance still approves it before they can trade.
          </p>

          {error ? <ErrorNote message={error} /> : null}

          <form onSubmit={submit} className="space-y-5">
            <Field
              label="Email, phone or @username"
              htmlFor="identifier"
              hint="How they sign in to AZA."
            >
              <Input
                id="identifier"
                required
                autoFocus
                value={form.identifier}
                onChange={set("identifier")}
                placeholder="kofi@example.com"
              />
            </Field>

            <Field label="Business name" htmlFor="businessName">
              <Input
                id="businessName"
                required
                value={form.businessName}
                onChange={set("businessName")}
                placeholder="Kofi Ventures"
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Location" htmlFor="location">
                <Input
                  id="location"
                  value={form.location}
                  onChange={set("location")}
                  placeholder="Adum, Kumasi"
                />
              </Field>
              <Field label="Till phone" htmlFor="contactPhone">
                <Input
                  id="contactPhone"
                  inputMode="tel"
                  value={form.contactPhone}
                  onChange={set("contactPhone")}
                  placeholder="024 000 0000"
                />
              </Field>
            </div>

            <Field label="Ghana Card number" htmlFor="idNumber">
              <Input
                id="idNumber"
                value={form.idNumber}
                onChange={set("idNumber")}
                placeholder="GHA-000000000-0"
              />
            </Field>

            <Field label="Notes for the reviewer" htmlFor="notes" hint="Optional.">
              <Textarea
                id="notes"
                value={form.applicationNotes}
                onChange={set("applicationNotes")}
                placeholder="Runs a busy till next to the market."
              />
            </Field>

            <Button type="submit" size="lg" className="w-full" loading={busy}>
              File application
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
