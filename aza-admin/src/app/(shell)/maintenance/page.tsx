"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSystemSettings, setMaintenanceMode, type SystemSettings } from "@/lib/admin-api";
import { AlertTriangle, Loader2, Wrench } from "lucide-react";

export default function MaintenancePage() {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");

  const { data, isLoading } = useQuery<SystemSettings>({
    queryKey: ["system-settings"],
    queryFn: getSystemSettings,
  });

  const toggle = useMutation({
    mutationFn: (enabled: boolean) => setMaintenanceMode(enabled),
    onSuccess: () => {
      setConfirm(false);
      setError("");
      qc.invalidateQueries({ queryKey: ["system-settings"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={20} className="animate-spin text-foreground/40" />
      </div>
    );
  }

  const enabled = data?.maintenanceMode ?? false;

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Maintenance Mode</h1>
        <p className="text-sm text-foreground/50 mt-0.5">
          When enabled, the app returns a 503 to all non-admin requests
        </p>
      </div>

      <div
        className={`rounded-xl border p-6 ${
          enabled
            ? "border-orange-500/30 bg-orange-500/5"
            : "border-border"
        }`}
      >
        <div className="flex items-center gap-3 mb-4">
          <Wrench size={20} className={enabled ? "text-orange-400" : "text-foreground/40"} />
          <div>
            <p className="font-medium text-foreground">Maintenance mode is currently</p>
            <p className={`text-sm font-semibold ${enabled ? "text-orange-400" : "text-emerald-400"}`}>
              {enabled ? "ENABLED — app is down for users" : "DISABLED — app is live"}
            </p>
          </div>
        </div>

        {enabled ? (
          <>
            <div className="rounded-lg border border-orange-500/20 bg-orange-500/10 px-4 py-3 text-sm text-orange-300 mb-4 flex items-start gap-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>
                All regular users are currently blocked. Restore access when maintenance is complete.
              </span>
            </div>
            {!confirm ? (
              <button
                onClick={() => setConfirm(true)}
                className="w-full py-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors text-sm font-medium"
              >
                Disable maintenance mode
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-foreground/70">
                  This will bring the platform back online for all users. Confirm?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => toggle.mutate(false)}
                    disabled={toggle.isPending}
                    className="flex-1 py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    {toggle.isPending ? "Disabling…" : "Yes, bring platform online"}
                  </button>
                  <button
                    onClick={() => setConfirm(false)}
                    className="px-4 py-2 rounded-lg border border-border text-sm text-foreground/70 hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-4 py-3 text-sm text-yellow-300 mb-4 flex items-start gap-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>
                Enabling maintenance mode will immediately block all user access. Only staff accounts
                can continue using the platform.
              </span>
            </div>
            {!confirm ? (
              <button
                onClick={() => setConfirm(true)}
                className="w-full py-2 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 transition-colors text-sm font-medium"
              >
                Enable maintenance mode
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-foreground/70">
                  This will take the platform offline for all regular users. Are you sure?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => toggle.mutate(true)}
                    disabled={toggle.isPending}
                    className="flex-1 py-2 rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    {toggle.isPending ? "Enabling…" : "Yes, enable maintenance mode"}
                  </button>
                  <button
                    onClick={() => setConfirm(false)}
                    className="px-4 py-2 rounded-lg border border-border text-sm text-foreground/70 hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}
        {error && <p className="text-xs text-red-400 mt-3">{error}</p>}
      </div>

      <div className="rounded-xl border border-border p-5 space-y-2">
        <p className="text-sm font-medium text-foreground">How it works</p>
        <ul className="text-sm text-foreground/50 space-y-1 list-disc list-inside">
          <li>All non-admin API requests return HTTP 503 Service Unavailable</li>
          <li>The mobile app and web app display a maintenance screen</li>
          <li>Staff accounts with an admin JWT bypass the block</li>
          <li>The change takes effect immediately — no restart required</li>
          <li>Changes to this setting go through the maker-checker approval queue when a second admin exists</li>
        </ul>
      </div>
    </div>
  );
}
