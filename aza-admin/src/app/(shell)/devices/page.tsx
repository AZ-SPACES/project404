"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getDeviceRegistry,
  getSuspiciousDevices,
  getBlockedDevices,
  blockDevice,
  unblockDevice,
  type DeviceRegistryRow,
  type SuspiciousDevice,
  type BlockedDevice,
  type Page,
} from "@/lib/admin-api";
import {
  Smartphone,
  Monitor,
  ShieldAlert,
  ShieldCheck,
  Loader2,
  AlertCircle,
  Ban,
  CheckCircle2,
  X,
  Users,
} from "lucide-react";

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function isDesktop(os: string | null) {
  if (!os) return false;
  return ["windows", "linux", "mac", "desktop", "web"].some(k => os.toLowerCase().includes(k));
}

function DeviceIcon({ os }: { os: string | null }) {
  const Icon = isDesktop(os) ? Monitor : Smartphone;
  return <Icon size={14} className="text-foreground/30 flex-shrink-0" />;
}

type Tab = "registry" | "suspicious" | "blocked";

interface BlockModal {
  deviceId: string;
  deviceName: string | null;
  deviceOs: string | null;
  associatedUserId?: string;
}

export default function DevicesPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("registry");
  const [page, setPage] = useState(0);
  const [threshold, setThreshold] = useState(1);
  const [blockModal, setBlockModal] = useState<BlockModal | null>(null);
  const [blockReason, setBlockReason] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  const { data: registry, isLoading: registryLoading, error: registryError } = useQuery<Page<DeviceRegistryRow>>({
    queryKey: ["deviceRegistry", page],
    queryFn: () => getDeviceRegistry(page, 20),
    enabled: tab === "registry",
  });

  const { data: suspicious, isLoading: suspiciousLoading } = useQuery<SuspiciousDevice[]>({
    queryKey: ["suspiciousDevices", threshold],
    queryFn: () => getSuspiciousDevices(threshold),
    enabled: tab === "suspicious",
  });

  const { data: blocked, isLoading: blockedLoading } = useQuery<BlockedDevice[]>({
    queryKey: ["blockedDevices"],
    queryFn: getBlockedDevices,
    enabled: tab === "blocked",
  });

  const blockMutation = useMutation({
    mutationFn: () => blockDevice(blockModal!.deviceId, {
      associatedUserId: blockModal!.associatedUserId,
      deviceName: blockModal!.deviceName ?? undefined,
      deviceOs: blockModal!.deviceOs ?? undefined,
      reason: blockReason || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deviceRegistry"] });
      queryClient.invalidateQueries({ queryKey: ["suspiciousDevices"] });
      queryClient.invalidateQueries({ queryKey: ["blockedDevices"] });
      setBlockModal(null);
      setBlockReason("");
      showToast("Device blocked — all active sessions terminated");
    },
  });

  const unblockMutation = useMutation({
    mutationFn: (deviceId: string) => unblockDevice(deviceId),
    onSuccess: (_, deviceId) => {
      queryClient.invalidateQueries({ queryKey: ["deviceRegistry"] });
      queryClient.invalidateQueries({ queryKey: ["suspiciousDevices"] });
      queryClient.invalidateQueries({ queryKey: ["blockedDevices"] });
      showToast(`Device unblocked`);
    },
  });

  const tabs: { key: Tab; label: string }[] = [
    { key: "registry", label: "Device Registry" },
    { key: "suspicious", label: "Suspicious Devices" },
    { key: "blocked", label: "Blocked Devices" },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-sm px-4 py-3 rounded-xl shadow-2xl">
          {toast}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-semibold text-foreground">Device Management</h1>
        <p className="text-foreground/40 text-sm mt-0.5">
          Block specific devices — more precise than IP blocking; works even when the actor switches networks
        </p>
      </div>

      <div className="flex gap-1 bg-muted/30 p-1 rounded-xl w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              tab === t.key ? "bg-[#B7EE7A] text-black" : "text-foreground/50 hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Registry ── */}
      {tab === "registry" && (
        <>
          {registryError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm flex items-center gap-2">
              <AlertCircle size={16} />{(registryError as Error).message}
            </div>
          )}
          {registryLoading ? (
            <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-foreground/30" size={24} /></div>
          ) : !registry || registry.content.length === 0 ? (
            <div className="text-center py-20 text-foreground/25">
              <Smartphone size={36} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">No devices found</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/10">
                    <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-foreground/30">Device</th>
                    <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-foreground/30 hidden md:table-cell">Location</th>
                    <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-foreground/30 hidden lg:table-cell">Last Seen</th>
                    <th className="text-center px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-foreground/30">Status</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {registry.content.map((d) => (
                    <tr key={d.deviceId} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <DeviceIcon os={d.deviceOs} />
                          <div>
                            <p className="text-sm font-medium text-foreground">{d.deviceName ?? "Unknown device"}</p>
                            <p className="text-xs text-foreground/35">{d.deviceOs ?? "Unknown OS"}</p>
                            <p className="text-[10px] text-foreground/20 font-mono truncate max-w-[160px]">{d.deviceId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 hidden md:table-cell">
                        <p className="text-xs text-foreground/50">{d.location ?? "—"}</p>
                      </td>
                      <td className="px-5 py-3 hidden lg:table-cell">
                        <p className="text-xs text-foreground/35">{fmtDate(d.lastSeenAt)}</p>
                      </td>
                      <td className="px-5 py-3 text-center">
                        {d.blocked ? (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 font-semibold">
                            <Ban size={10} /> Blocked
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 size={10} /> Active
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {d.blocked ? (
                          <button
                            onClick={() => unblockMutation.mutate(d.deviceId)}
                            disabled={unblockMutation.isPending}
                            className="text-xs px-3 py-1.5 rounded-lg bg-muted/30 hover:bg-muted text-foreground/60 hover:text-foreground transition-colors disabled:opacity-40"
                          >
                            Unblock
                          </button>
                        ) : (
                          <button
                            onClick={() => { setBlockModal({ deviceId: d.deviceId, deviceName: d.deviceName, deviceOs: d.deviceOs }); setBlockReason(""); }}
                            className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors"
                          >
                            Block
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {registry.totalPages > 1 && (
                <div className="flex justify-center items-center gap-3 px-5 py-4 border-t border-border">
                  <button onClick={() => setPage(p => p - 1)} disabled={page === 0} className="px-4 py-2 text-sm rounded-xl bg-muted/30 hover:bg-muted disabled:opacity-30 border border-border">Previous</button>
                  <span className="text-sm text-foreground/40">{page + 1} / {registry.totalPages}</span>
                  <button onClick={() => setPage(p => p + 1)} disabled={page >= registry.totalPages - 1} className="px-4 py-2 text-sm rounded-xl bg-muted/30 hover:bg-muted disabled:opacity-30 border border-border">Next</button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Suspicious ── */}
      {tab === "suspicious" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <p className="text-sm text-foreground/50">Show devices used by more than</p>
            <select
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="px-3 py-1.5 bg-muted/30 border border-border rounded-lg text-sm text-foreground focus:outline-none"
            >
              {[1, 2, 3, 5].map(n => <option key={n} value={n}>{n} account{n > 1 ? "s" : ""}</option>)}
            </select>
          </div>

          {suspiciousLoading ? (
            <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-foreground/30" size={24} /></div>
          ) : !suspicious || suspicious.length === 0 ? (
            <div className="text-center py-20 text-foreground/25">
              <ShieldCheck size={36} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">No suspicious devices found at this threshold</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/10">
                    <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-foreground/30">Device</th>
                    <th className="text-center px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-foreground/30">Accounts</th>
                    <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-foreground/30 hidden md:table-cell">Last Seen</th>
                    <th className="text-center px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-foreground/30">Status</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {suspicious.map((d) => (
                    <tr key={d.deviceId} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <DeviceIcon os={d.deviceOs} />
                          <div>
                            <p className="text-sm font-medium text-foreground">{d.deviceName ?? "Unknown device"}</p>
                            <p className="text-xs text-foreground/35">{d.deviceOs ?? "Unknown OS"}</p>
                            <p className="text-[10px] text-foreground/20 font-mono truncate max-w-[160px]">{d.deviceId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className="inline-flex items-center gap-1.5 text-sm font-bold text-amber-400">
                          <Users size={13} />
                          {d.userCount}
                        </span>
                      </td>
                      <td className="px-5 py-3 hidden md:table-cell">
                        <p className="text-xs text-foreground/35">{fmtDate(d.lastSeenAt)}</p>
                      </td>
                      <td className="px-5 py-3 text-center">
                        {d.blocked ? (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 font-semibold">
                            <Ban size={10} /> Blocked
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <ShieldAlert size={10} /> Suspicious
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {d.blocked ? (
                          <button
                            onClick={() => unblockMutation.mutate(d.deviceId)}
                            disabled={unblockMutation.isPending}
                            className="text-xs px-3 py-1.5 rounded-lg bg-muted/30 hover:bg-muted text-foreground/60 hover:text-foreground transition-colors disabled:opacity-40"
                          >
                            Unblock
                          </button>
                        ) : (
                          <button
                            onClick={() => { setBlockModal({ deviceId: d.deviceId, deviceName: d.deviceName, deviceOs: d.deviceOs }); setBlockReason(""); }}
                            className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors"
                          >
                            Block
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Blocked ── */}
      {tab === "blocked" && (
        <>
          {blockedLoading ? (
            <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-foreground/30" size={24} /></div>
          ) : !blocked || blocked.length === 0 ? (
            <div className="text-center py-20 text-foreground/25">
              <ShieldCheck size={36} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">No blocked devices</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/10">
                    <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-foreground/30">Device</th>
                    <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-foreground/30 hidden md:table-cell">Reason</th>
                    <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-foreground/30 hidden lg:table-cell">Blocked By</th>
                    <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-foreground/30 hidden lg:table-cell">Blocked At</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {blocked.map((d) => (
                    <tr key={d.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <DeviceIcon os={d.deviceOs} />
                          <div>
                            <p className="text-sm font-medium text-foreground">{d.deviceName ?? "Unknown device"}</p>
                            <p className="text-xs text-foreground/35">{d.deviceOs ?? "Unknown OS"}</p>
                            <p className="text-[10px] text-foreground/20 font-mono truncate max-w-[160px]">{d.deviceId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 hidden md:table-cell">
                        <p className="text-xs text-foreground/50 max-w-[200px] truncate">{d.reason ?? "—"}</p>
                      </td>
                      <td className="px-5 py-3 hidden lg:table-cell">
                        <p className="text-xs text-foreground/40">{d.blockedByEmail}</p>
                      </td>
                      <td className="px-5 py-3 hidden lg:table-cell">
                        <p className="text-xs text-foreground/35">{fmtDate(d.blockedAt)}</p>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => unblockMutation.mutate(d.deviceId)}
                          disabled={unblockMutation.isPending}
                          className="text-xs px-3 py-1.5 rounded-lg bg-muted/30 hover:bg-muted text-foreground/60 hover:text-foreground transition-colors disabled:opacity-40"
                        >
                          Unblock
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Block modal ── */}
      {blockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setBlockModal(null)} />
          <div className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-foreground">Block Device</h3>
              <button onClick={() => setBlockModal(null)} className="text-foreground/40 hover:text-foreground"><X size={18} /></button>
            </div>

            <div className="bg-muted/20 border border-border rounded-xl p-4 mb-4">
              <div className="flex items-center gap-2 mb-1">
                <DeviceIcon os={blockModal.deviceOs} />
                <p className="text-sm font-medium text-foreground">{blockModal.deviceName ?? "Unknown device"}</p>
              </div>
              <p className="text-xs text-foreground/40">{blockModal.deviceOs ?? "Unknown OS"}</p>
              <p className="text-[10px] text-foreground/25 font-mono mt-1 break-all">{blockModal.deviceId}</p>
            </div>

            <div className="bg-amber-500/8 border border-amber-500/15 rounded-xl px-4 py-3 mb-4">
              <p className="text-xs text-amber-400">
                This will immediately terminate all active sessions on this device and prevent any future logins.
              </p>
            </div>

            <div className="mb-5">
              <label className="text-xs font-semibold text-foreground/40 uppercase tracking-wider block mb-2">Reason (optional)</label>
              <textarea
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="Compromised device, fraud activity, account takeover…"
                rows={3}
                className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/20 resize-none"
              />
            </div>

            {blockMutation.error && (
              <p className="text-red-400 text-sm mb-3">{(blockMutation.error as Error).message}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => blockMutation.mutate()}
                disabled={blockMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/15 border border-red-500/25 text-red-400 text-sm font-semibold hover:bg-red-500/25 disabled:opacity-50 transition-all"
              >
                {blockMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />}
                Block Device
              </button>
              <button
                onClick={() => setBlockModal(null)}
                className="px-4 py-2.5 rounded-xl bg-muted/30 text-foreground/50 text-sm hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
