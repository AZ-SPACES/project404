"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  changeStaffRole,
  getStaff,
  getUsers,
  grantStaffRole,
  isPendingApproval,
  revokeStaffRole,
  type AdminUser,
  type StaffMember,
  type StaffRoleName,
} from "@/lib/admin-api";
import { ArrowLeftRight, Loader2, Search, ShieldCheck, UserPlus, Users2, X } from "lucide-react";

const ALL_ROLES: StaffRoleName[] = ["SUPPORT", "COMPLIANCE", "FINANCE", "ADMIN"];

const ROLE_STYLES: Record<StaffRoleName, string> = {
  ADMIN: "bg-red-500/10 text-red-400 border-red-500/20",
  COMPLIANCE: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  FINANCE: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  SUPPORT: "bg-green-500/10 text-green-400 border-green-500/20",
};

const ROLE_DESCRIPTIONS: Record<StaffRoleName, string> = {
  SUPPORT: "User lookup, support inbox, disputes",
  COMPLIANCE: "KYC review, AML flags, risk alerts, account actions",
  FINANCE: "Wallets, fees, merchants, settlements, reports",
  ADMIN: "Everything, including settings and role grants",
};

function RoleBadge({
  role,
  onRevoke,
  revoking,
}: {
  role: StaffRoleName;
  onRevoke?: () => void;
  revoking?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${ROLE_STYLES[role]}`}
    >
      {role}
      {onRevoke && (
        <button
          onClick={onRevoke}
          disabled={revoking}
          title={`Revoke ${role}`}
          className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity cursor-pointer disabled:opacity-30"
        >
          {revoking ? <Loader2 size={11} className="animate-spin" /> : <X size={11} />}
        </button>
      )}
    </span>
  );
}

function AddStaffPanel({ onClose, onPending }: { onClose: () => void; onPending: (msg: string) => void }) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [role, setRole] = useState<StaffRoleName>("SUPPORT");
  const [error, setError] = useState("");

  const { data: results, isFetching } = useQuery({
    queryKey: ["staffUserSearch", search],
    queryFn: () => getUsers({ query: search, size: 6 }),
    enabled: search.length >= 2,
  });

  const grant = useMutation({
    mutationFn: () => grantStaffRole(selected!.id, role),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      if (isPendingApproval(result)) {
        onPending("Grant submitted — another ADMIN must approve it in Approvals.");
      }
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="rounded-xl border border-border p-5 mb-6 space-y-4 bg-muted/10">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-foreground">Grant a staff role</h2>
        <button onClick={onClose} className="text-foreground/40 hover:text-foreground transition-colors">
          <X size={16} />
        </button>
      </div>

      {!selected ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(query.trim());
          }}
          className="space-y-3"
        >
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/30" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search users by name, email, or handle…"
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-foreground/30 transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={query.trim().length < 2 || isFetching}
              className="px-4 py-2 rounded-lg bg-muted/30 hover:bg-muted text-sm disabled:opacity-30 transition-colors"
            >
              {isFetching ? <Loader2 size={14} className="animate-spin" /> : "Search"}
            </button>
          </div>

          {results && results.content.length === 0 && (
            <p className="text-sm text-foreground/40">No users match that search.</p>
          )}
          {results && results.content.length > 0 && (
            <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
              {results.content.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => setSelected(user)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-muted/30 transition-colors"
                >
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      {user.firstName} {user.lastName}
                    </div>
                    <div className="text-xs text-foreground/40">
                      {user.email} {user.username ? `· @${user.username}` : ""}
                    </div>
                  </div>
                  <UserPlus size={14} className="text-foreground/30" />
                </button>
              ))}
            </div>
          )}
        </form>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border px-4 py-2.5">
            <div>
              <div className="text-sm font-medium text-foreground">
                {selected.firstName} {selected.lastName}
              </div>
              <div className="text-xs text-foreground/40">{selected.email}</div>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="text-xs text-foreground/40 hover:text-foreground transition-colors"
            >
              Change
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ALL_ROLES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                  role === r ? "border-[#B7EE7A] bg-[#B7EE7A]/10" : "border-border hover:bg-muted/30"
                }`}
              >
                <div className="text-sm font-medium text-foreground">{r}</div>
                <div className="text-xs text-foreground/40">{ROLE_DESCRIPTIONS[r]}</div>
              </button>
            ))}
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            onClick={() => grant.mutate()}
            disabled={grant.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#B7EE7A] hover:bg-[#B7EE7A]/90 text-black text-sm font-semibold disabled:opacity-50 transition-colors"
          >
            {grant.isPending && <Loader2 size={14} className="animate-spin" />}
            Grant {role}
          </button>
        </div>
      )}
    </div>
  );
}

function ChangeRolePanel({
  member,
  onDone,
}: {
  member: StaffMember;
  onDone: (pendingMsg?: string) => void;
}) {
  const held = member.roles.map((r) => r.role);
  const [fromRole, setFromRole] = useState<StaffRoleName>(held[0]);
  const [toRole, setToRole] = useState<StaffRoleName>(
    ALL_ROLES.find((r) => !held.includes(r)) ?? "SUPPORT",
  );
  const [error, setError] = useState("");

  const change = useMutation({
    mutationFn: () => changeStaffRole(member.userId, fromRole, toRole),
    onSuccess: (result) => {
      onDone(isPendingApproval(result)
        ? "Role change submitted — another ADMIN must approve it in Approvals."
        : undefined);
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        change.mutate();
      }}
      className="flex flex-wrap items-center gap-2 mt-3 pl-13"
    >
      <select
        value={fromRole}
        onChange={(e) => setFromRole(e.target.value as StaffRoleName)}
        className="px-3 py-1.5 rounded-lg bg-background border border-border text-xs outline-none"
      >
        {held.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>
      <ArrowLeftRight size={12} className="text-foreground/40" />
      <select
        value={toRole}
        onChange={(e) => setToRole(e.target.value as StaffRoleName)}
        className="px-3 py-1.5 rounded-lg bg-background border border-border text-xs outline-none"
      >
        {ALL_ROLES.filter((r) => !held.includes(r)).map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>
      <button
        type="submit"
        disabled={change.isPending || held.includes(toRole)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#B7EE7A] hover:bg-[#B7EE7A]/90 text-black text-xs font-semibold disabled:opacity-40 transition-colors"
      >
        {change.isPending && <Loader2 size={12} className="animate-spin" />}
        Change role
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </form>
  );
}

export default function StaffPage() {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [changing, setChanging] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const { data: staff, isLoading } = useQuery<StaffMember[]>({
    queryKey: ["staff"],
    queryFn: getStaff,
  });

  const revoke = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: StaffRoleName }) =>
      revokeStaffRole(userId, role),
    onMutate: ({ userId, role }) => setRevoking(`${userId}:${role}`),
    onSettled: () => setRevoking(null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff"] }),
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground mb-1">Staff &amp; Roles</h1>
          <p className="text-foreground/50 text-sm">
            Who can access the back office, and what they can do. Grants and revocations are audit-logged.
          </p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#B7EE7A] hover:bg-[#B7EE7A]/90 text-black text-sm font-semibold transition-colors"
        >
          <UserPlus size={14} />
          Add staff
        </button>
      </div>

      {adding && <AddStaffPanel onClose={() => setAdding(false)} onPending={setNotice} />}

      {notice && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3 text-emerald-400 text-sm mb-6 flex items-center justify-between">
          {notice}
          <button onClick={() => setNotice("")}>
            <X size={14} />
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm mb-6 flex items-center justify-between">
          {error}
          <button onClick={() => setError("")}>
            <X size={14} />
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-muted/30 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !staff || staff.length === 0 ? (
        <div className="text-center py-24 text-foreground/30">
          <Users2 size={40} className="mx-auto mb-4 opacity-40" />
          <p>No staff members yet</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
          {staff.map((member) => (
            <div key={member.userId} className="px-5 py-4">
              <div className="flex items-center gap-4">
                {member.profileImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={member.profileImageUrl}
                    alt=""
                    className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-muted/50 flex items-center justify-center flex-shrink-0">
                    <ShieldCheck size={15} className="text-foreground/30" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{member.name}</div>
                  <div className="text-xs text-foreground/40 truncate">
                    {member.email} {member.handle ? `· @${member.handle}` : ""}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 justify-end">
                  {member.roles.map((grant) => (
                    <RoleBadge
                      key={grant.role}
                      role={grant.role}
                      revoking={revoking === `${member.userId}:${grant.role}`}
                      onRevoke={() => revoke.mutate({ userId: member.userId, role: grant.role })}
                    />
                  ))}
                  {member.roles.length > 0 && member.roles.length < 4 && (
                    <button
                      onClick={() => setChanging(changing === member.userId ? null : member.userId)}
                      title="Change a role (atomic swap, no access gap)"
                      className="flex items-center gap-1 px-2 py-1 rounded-full text-xs text-foreground/40 border border-border hover:text-foreground hover:bg-muted/30 transition-colors"
                    >
                      <ArrowLeftRight size={11} />
                      Change
                    </button>
                  )}
                </div>
              </div>
              {changing === member.userId && (
                <ChangeRolePanel
                  member={member}
                  onDone={(pendingMsg) => {
                    setChanging(null);
                    if (pendingMsg) setNotice(pendingMsg);
                    queryClient.invalidateQueries({ queryKey: ["staff"] });
                  }}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
