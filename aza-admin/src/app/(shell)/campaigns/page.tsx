"use client";

import { useState } from "react";
import { sendCampaign } from "@/lib/admin-api";
import { CheckCircle2, AlertCircle } from "lucide-react";

export default function CampaignsPage() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<"EMAIL" | "SMS">("EMAIL");
  const [segment, setSegment] = useState<string>("ALL_USERS");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await sendCampaign({
        type,
        segment,
        subject: type === "EMAIL" ? subject : undefined,
        message,
      });

      setSuccess("Campaign has been successfully queued for sending!");
      setSubject("");
      setMessage("");
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to queue campaign.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Send bulk email and SMS campaigns to user segments.
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="type" className="text-sm font-medium">Campaign Type</label>
              <select
                id="type"
                value={type}
                onChange={(e) => setType(e.target.value as "EMAIL" | "SMS")}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#111827] focus:border-transparent transition-colors"
                required
              >
                <option value="EMAIL">Email</option>
                <option value="SMS">SMS</option>
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="segment" className="text-sm font-medium">Target Audience</label>
              <select
                id="segment"
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#111827] focus:border-transparent transition-colors"
                required
              >
                <option value="ALL_USERS">All Users</option>
                <option value="ACTIVE_USERS">Active Users</option>
                <option value="APPROVED_KYC">Approved KYC Users</option>
                <option value="UNAPPROVED_KYC">Unapproved/Rejected KYC</option>
                <option value="NOT_STARTED_KYC">KYC Not Started</option>
                <option value="MERCHANTS">Merchants</option>
              </select>
            </div>
          </div>

          {type === "EMAIL" && (
            <div className="space-y-2">
              <label htmlFor="subject" className="text-sm font-medium">Email Subject</label>
              <input
                id="subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Announcing new features!"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#111827] focus:border-transparent transition-colors"
                required={type === "EMAIL"}
              />
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="message" className="text-sm font-medium">
              Message Content
            </label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={type === "EMAIL" ? "Type your email content here. Line breaks will be preserved." : "Type your SMS content here..."}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#111827] focus:border-transparent transition-colors min-h-[200px] resize-y"
              required
            />
            {type === "EMAIL" && (
              <p className="text-xs text-muted-foreground mt-1">
                The email will be wrapped in the standard AZA template automatically. Line breaks are converted to paragraph spacing.
              </p>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-100">
              <AlertCircle size={16} className="shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 p-3 text-sm text-green-700 bg-green-50 rounded-lg border border-green-100">
              <CheckCircle2 size={16} className="shrink-0" />
              <p>{success}</p>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-[#111827] text-white rounded-lg text-sm font-medium hover:bg-[#1f2937] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Queueing Campaign..." : "Send Campaign"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
