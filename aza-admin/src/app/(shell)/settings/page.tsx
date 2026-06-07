"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSystemSettings, updateSystemSettings, SystemSettings } from "@/lib/admin-api";
import {
  Settings, AlertCircle, CheckCircle2, Loader2, Save, AlertTriangle, Globe, X,
} from "lucide-react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
  Sphere,
  Graticule,
  type Geography as GeoFeature,
} from "react-simple-maps";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const GEO_URL = require("world-atlas/countries-110m.json");

// ISO numeric → alpha-2 mapping
const NUM_TO_A2: Record<string, string> = {
  "004":"AF","008":"AL","012":"DZ","024":"AO","032":"AR","051":"AM","036":"AU","040":"AT",
  "031":"AZ","048":"BH","050":"BD","112":"BY","056":"BE","204":"BJ","068":"BO","070":"BA",
  "072":"BW","076":"BR","100":"BG","854":"BF","108":"BI","116":"KH","120":"CM","124":"CA",
  "140":"CF","148":"TD","152":"CL","156":"CN","170":"CO","178":"CG","180":"CD","188":"CR",
  "384":"CI","191":"HR","192":"CU","196":"CY","203":"CZ","208":"DK","262":"DJ","214":"DO",
  "218":"EC","818":"EG","222":"SV","226":"GQ","232":"ER","233":"EE","231":"ET","246":"FI",
  "250":"FR","266":"GA","270":"GM","268":"GE","276":"DE","288":"GH","300":"GR","320":"GT",
  "324":"GN","624":"GW","332":"HT","340":"HN","348":"HU","356":"IN","360":"ID","364":"IR",
  "368":"IQ","372":"IE","376":"IL","380":"IT","388":"JM","392":"JP","400":"JO","398":"KZ",
  "404":"KE","408":"KP","410":"KR","414":"KW","417":"KG","418":"LA","428":"LV","422":"LB",
  "430":"LR","434":"LY","440":"LT","442":"LU","450":"MG","454":"MW","458":"MY","466":"ML",
  "478":"MR","484":"MX","498":"MD","496":"MN","499":"ME","504":"MA","508":"MZ","104":"MM",
  "516":"NA","524":"NP","528":"NL","554":"NZ","558":"NI","562":"NE","566":"NG","578":"NO",
  "512":"OM","586":"PK","591":"PA","600":"PY","604":"PE","608":"PH","616":"PL","620":"PT",
  "634":"QA","642":"RO","643":"RU","646":"RW","682":"SA","686":"SN","688":"RS","694":"SL",
  "702":"SG","703":"SK","705":"SI","706":"SO","710":"ZA","728":"SS","724":"ES","144":"LK",
  "729":"SD","752":"SE","756":"CH","760":"SY","158":"TW","762":"TJ","834":"TZ","764":"TH",
  "768":"TG","788":"TN","792":"TR","795":"TM","800":"UG","804":"UA","784":"AE","826":"GB",
  "840":"US","858":"UY","860":"UZ","862":"VE","704":"VN","887":"YE","894":"ZM","716":"ZW",
  "044":"BS","052":"BB","028":"AG","662":"LC","670":"VC","308":"GD","780":"TT","630":"PR",
  "090":"SB","548":"VU","242":"FJ","598":"PG","585":"PW","583":"FM","584":"MH","520":"NR",
};

const COUNTRY_NAMES: Record<string, string> = {
  AF:"Afghanistan",AL:"Albania",DZ:"Algeria",AO:"Angola",AR:"Argentina",AM:"Armenia",
  AU:"Australia",AT:"Austria",AZ:"Azerbaijan",BH:"Bahrain",BD:"Bangladesh",BY:"Belarus",
  BE:"Belgium",BJ:"Benin",BO:"Bolivia",BA:"Bosnia",BW:"Botswana",BR:"Brazil",BG:"Bulgaria",
  BF:"Burkina Faso",BI:"Burundi",KH:"Cambodia",CM:"Cameroon",CA:"Canada",CF:"C. African Rep.",
  TD:"Chad",CL:"Chile",CN:"China",CO:"Colombia",CG:"Congo",CD:"DR Congo",CR:"Costa Rica",
  CI:"Côte d'Ivoire",HR:"Croatia",CU:"Cuba",CY:"Cyprus",CZ:"Czechia",DK:"Denmark",
  DJ:"Djibouti",DO:"Dominican Rep.",EC:"Ecuador",EG:"Egypt",SV:"El Salvador",GQ:"Eq. Guinea",
  ER:"Eritrea",EE:"Estonia",ET:"Ethiopia",FI:"Finland",FR:"France",GA:"Gabon",GM:"Gambia",
  GE:"Georgia",DE:"Germany",GH:"Ghana",GR:"Greece",GT:"Guatemala",GN:"Guinea",
  GW:"Guinea-Bissau",HT:"Haiti",HN:"Honduras",HU:"Hungary",IN:"India",ID:"Indonesia",
  IR:"Iran",IQ:"Iraq",IE:"Ireland",IL:"Israel",IT:"Italy",JM:"Jamaica",JP:"Japan",
  JO:"Jordan",KZ:"Kazakhstan",KE:"Kenya",KP:"North Korea",KR:"South Korea",KW:"Kuwait",
  KG:"Kyrgyzstan",LA:"Laos",LV:"Latvia",LB:"Lebanon",LR:"Liberia",LY:"Libya",LT:"Lithuania",
  LU:"Luxembourg",MG:"Madagascar",MW:"Malawi",MY:"Malaysia",ML:"Mali",MR:"Mauritania",
  MX:"Mexico",MD:"Moldova",MN:"Mongolia",ME:"Montenegro",MA:"Morocco",MZ:"Mozambique",
  MM:"Myanmar",NA:"Namibia",NP:"Nepal",NL:"Netherlands",NZ:"New Zealand",NI:"Nicaragua",
  NE:"Niger",NG:"Nigeria",NO:"Norway",OM:"Oman",PK:"Pakistan",PA:"Panama",PY:"Paraguay",
  PE:"Peru",PH:"Philippines",PL:"Poland",PT:"Portugal",QA:"Qatar",RO:"Romania",RU:"Russia",
  RW:"Rwanda",SA:"Saudi Arabia",SN:"Senegal",RS:"Serbia",SL:"Sierra Leone",SG:"Singapore",
  SK:"Slovakia",SI:"Slovenia",SO:"Somalia",ZA:"South Africa",SS:"South Sudan",ES:"Spain",
  LK:"Sri Lanka",SD:"Sudan",SE:"Sweden",CH:"Switzerland",SY:"Syria",TW:"Taiwan",TJ:"Tajikistan",
  TZ:"Tanzania",TH:"Thailand",TG:"Togo",TN:"Tunisia",TR:"Turkey",TM:"Turkmenistan",UG:"Uganda",
  UA:"Ukraine",AE:"UAE",GB:"United Kingdom",US:"United States",UY:"Uruguay",UZ:"Uzbekistan",
  VE:"Venezuela",VN:"Vietnam",YE:"Yemen",ZM:"Zambia",ZW:"Zimbabwe",
};

// Countries in currently blocked set shown as a pill
function BlockedPill({ code, onRemove }: { code: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-xs font-medium text-red-400">
      <span className="font-mono font-semibold">{code}</span>
      <span className="text-red-400/60">{COUNTRY_NAMES[code] ?? "Unknown"}</span>
      <button onClick={onRemove} className="ml-0.5 hover:text-red-300 transition-colors">
        <X size={12} />
      </button>
    </span>
  );
}

const WorldMap = function WorldMap({
  blocked,
  onToggle,
}: {
  blocked: Set<string>;
  onToggle: (code: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ name: string; code: string; blocked: boolean } | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  // d3-zoom intercepts mousedown/mouseup and kills the click event via stopImmediatePropagation;
  // pointer events are not handled by d3-zoom so they propagate normally.
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

  const getA2 = useCallback((geo: GeoFeature) => NUM_TO_A2[String(geo.id).padStart(3, "0")] ?? null, []);

  const handleMouseMove = useCallback((e: React.MouseEvent, a2: string, isBlocked: boolean) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setTooltip({ name: COUNTRY_NAMES[a2] ?? a2, code: a2, blocked: isBlocked });
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  return (
    <div ref={containerRef} className="relative w-full rounded-xl overflow-hidden border border-white/5 select-none" style={{ background: "#0e1117" }}>
      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-20 px-2.5 py-1.5 rounded-lg shadow-xl text-xs whitespace-nowrap"
          style={{
            left: pos.x + 14,
            top: pos.y - 14,
            background: "rgba(15,20,30,0.95)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <span className="font-mono font-bold text-white/40 mr-1.5">{tooltip.code}</span>
          <span className={tooltip.blocked ? "text-red-400 font-semibold" : "text-white/80"}>
            {tooltip.name}
          </span>
          {tooltip.blocked && <span className="ml-1.5 text-red-400/50">· blocked</span>}
        </div>
      )}

      <ComposableMap
        projection="geoEqualEarth"
        projectionConfig={{ scale: 153 }}
        style={{ width: "100%", height: "auto" }}
        width={800}
        height={420}
      >
        {/* Ocean */}
        <Sphere fill="#0a1628" stroke="#1e3a5f" strokeWidth={0.4} />
        {/* Lat/lon grid */}
        <Graticule stroke="#1e3a5f" strokeWidth={0.3} />

        <ZoomableGroup center={[0, 0]} zoom={1} minZoom={1} maxZoom={6}>
          <Geographies geography={GEO_URL}>
            {({ geographies }: { geographies: GeoFeature[] }) =>
              geographies.map((geo: GeoFeature) => {
                const a2 = getA2(geo);
                const isBlocked = a2 ? blocked.has(a2) : false;
                const GeographyAny = Geography as any;
                return (
                  <GeographyAny
                    key={`${geo.rsmKey}-${isBlocked ? 1 : 0}`}
                    geography={geo}
                    onMouseDown={(e: React.MouseEvent<SVGPathElement>) => { pointerStart.current = { x: e.clientX, y: e.clientY }; }}
                    onMouseUp={(e: React.MouseEvent<SVGPathElement>) => {
                      if (!pointerStart.current || !a2) return;
                      const dx = e.clientX - pointerStart.current.x;
                      const dy = e.clientY - pointerStart.current.y;
                      if (dx * dx + dy * dy < 25) onToggle(a2);
                      pointerStart.current = null;
                    }}
                    onMouseMove={(e: React.MouseEvent) => { if (a2) handleMouseMove(e, a2, isBlocked); }}
                    onMouseLeave={() => setTooltip(null)}
                    style={{
                      default: {
                        fill: isBlocked ? "#dc262680" : "#1e3a5f",
                        stroke: "#0a1628",
                        strokeWidth: 0.4,
                        outline: "none",
                        cursor: a2 ? "pointer" : "default",
                      },
                      hover: {
                        fill: isBlocked ? "#ef4444" : "#2d5a8e",
                        stroke: "#0a1628",
                        strokeWidth: 0.4,
                        outline: "none",
                        cursor: a2 ? "pointer" : "default",
                      },
                      pressed: {
                        fill: isBlocked ? "#991b1b" : "#1d4ed8",
                        outline: "none",
                      },
                    }}
                  />
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      {/* Legend */}
      <div className="absolute bottom-3 right-4 flex items-center gap-4 text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: "#1e3a5f", border: "1px solid rgba(255,255,255,0.1)" }} />
          Allowed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: "#dc2626" }} />
          Blocked
        </span>
        <span style={{ color: "rgba(255,255,255,0.15)" }}>· Scroll to zoom · Click to toggle</span>
      </div>
    </div>
  );
};

function Toggle({ enabled, onChange, label, description, danger }: {
  enabled: boolean; onChange: (v: boolean) => void; label: string; description?: string; danger?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-border last:border-0">
      <div className="flex-1 mr-4">
        <p className={`text-sm font-medium ${danger ? "text-red-300" : "text-foreground/80"}`}>{label}</p>
        {description && <p className="text-xs text-foreground/35 mt-0.5">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${enabled ? danger ? "bg-red-500" : "bg-[#B7EE7A]" : "bg-muted/50"}`}
      >
        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-7" : "translate-x-1"}`} />
      </button>
    </div>
  );
}

function NumberInput({ label, description, value, onChange, prefix }: {
  label: string; description?: string; value: number; onChange: (v: number) => void; prefix?: string;
}) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-border last:border-0">
      <div className="flex-1 mr-4">
        <p className="text-sm font-medium text-foreground/80">{label}</p>
        {description && <p className="text-xs text-foreground/35 mt-0.5">{description}</p>}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {prefix && <span className="text-xs text-foreground/40 font-medium">{prefix}</span>}
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-28 bg-muted/30 border border-border rounded-lg px-3 py-1.5 text-sm text-foreground text-right focus:outline-none focus:border-border transition-colors"
        />
      </div>
    </div>
  );
}

function TextInput({ label, description, value, onChange }: {
  label: string; description?: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="py-4 border-b border-border last:border-0">
      <div className="mb-2">
        <p className="text-sm font-medium text-foreground/80">{label}</p>
        {description && <p className="text-xs text-foreground/35 mt-0.5">{description}</p>}
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-border transition-colors"
      />
    </div>
  );
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<SystemSettings | null>(null);
  const [success, setSuccess] = useState(false);

  const { data: settings, isLoading, error } = useQuery<SystemSettings>({
    queryKey: ["systemSettings"],
    queryFn: getSystemSettings,
  });

  useEffect(() => {
    if (settings) setDraft(settings);
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: () => updateSystemSettings(draft!),
    onSuccess: (updated) => {
      queryClient.setQueryData(["systemSettings"], updated);
      setDraft(updated);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    },
  });

  const hasChanges = JSON.stringify(draft) !== JSON.stringify(settings);

  const set = (key: keyof SystemSettings, value: unknown) =>
    setDraft((prev) => prev ? { ...prev, [key]: value } : prev);

  const setFlag = (key: keyof SystemSettings["featureFlags"], value: boolean) =>
    setDraft((prev) => prev ? { ...prev, featureFlags: { ...prev.featureFlags, [key]: value } } : prev);

  const blockedSet = new Set(draft?.blockedCountries ?? []);

  const toggleCountry = useCallback((code: string) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const current = new Set(prev.blockedCountries ?? []);
      if (current.has(code)) current.delete(code);
      else current.add(code);
      return { ...prev, blockedCountries: Array.from(current) };
    });
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-foreground/30" size={28} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">System Settings</h1>
          <p className="text-foreground/40 text-sm mt-0.5">Platform configuration and feature management</p>
        </div>
        {draft?.platformVersion && (
          <span className="px-3 py-1.5 rounded-full bg-muted/30 border border-border text-xs text-foreground/40 font-mono">
            v{draft.platformVersion}
          </span>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle size={16} />{(error as Error).message}
        </div>
      )}
      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-emerald-400 text-sm flex items-center gap-2">
          <CheckCircle2 size={16} />Settings saved successfully.
        </div>
      )}
      {saveMutation.error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle size={16} />{(saveMutation.error as Error).message}
        </div>
      )}

      {!draft && !error ? (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-4 text-amber-400 text-sm flex items-center gap-3">
          <AlertCircle size={18} className="flex-shrink-0" />
          <div>
            <p className="font-semibold">Settings endpoint not yet connected.</p>
            <p className="text-amber-400/70 text-xs mt-0.5">This page will be fully functional once the backend settings API is implemented.</p>
          </div>
        </div>
      ) : draft && (
        <>
          {/* Platform Operations */}
          <div className="bg-card border border-border rounded-2xl px-5">
            <div className="py-4 border-b border-border">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-foreground/30 flex items-center gap-2">
                <Settings size={13} />Platform Operations
              </h3>
            </div>
            {draft.maintenanceMode && (
              <div className="mt-4 mb-2 flex items-center gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl">
                <AlertTriangle size={15} className="text-red-400 flex-shrink-0" />
                <p className="text-xs text-red-400">
                  <span className="font-bold">Maintenance mode is ON.</span> All user-facing operations are suspended.
                </p>
              </div>
            )}
            <Toggle label="Maintenance Mode" description="Suspend all user-facing operations for system maintenance"
              enabled={draft.maintenanceMode} onChange={(v) => set("maintenanceMode", v)} danger />
            <Toggle label="User Registration" description="Allow new users to create accounts"
              enabled={draft.registrationEnabled} onChange={(v) => set("registrationEnabled", v)} />
            <Toggle label="KYC Required" description="Require KYC verification before users can transact"
              enabled={draft.kycRequired} onChange={(v) => set("kycRequired", v)} />
          </div>

          {/* Transaction Limits */}
          <div className="bg-card border border-border rounded-2xl px-5">
            <div className="py-4 border-b border-border">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-foreground/30">Default Transaction Limits</h3>
            </div>
            <p className="text-xs text-foreground/30 pt-4 pb-1">Platform-wide defaults. Individual users can have custom limits set on their profile page.</p>
            <NumberInput label="Default Max Daily Transfer" description="Applies to users without a custom daily limit"
              value={draft.maxDailyTransferGhs} onChange={(v) => set("maxDailyTransferGhs", v)} prefix="GHS" />
            <NumberInput label="Default Max Single Transaction" description="Applies to users without a custom single-transaction limit"
              value={draft.maxSingleTransactionGhs} onChange={(v) => set("maxSingleTransactionGhs", v)} prefix="GHS" />
          </div>

          {/* Geo-Blocking */}
          <div className="bg-card border border-border rounded-2xl px-5">
            <div className="py-4 border-b border-border">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-foreground/30 flex items-center gap-2">
                <Globe size={13} />Geo-Blocking
              </h3>
            </div>
            <div className="py-4">
              <p className="text-xs text-foreground/35 mb-4">
                Click a country on the map to block or unblock it. Changes are pushed to Cloudflare WAF on save (drops at edge) and to the app layer within 60 seconds.
              </p>

              <WorldMap blocked={blockedSet} onToggle={toggleCountry} />

              {/* Blocked country pills */}
              {blockedSet.size > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {Array.from(blockedSet).sort().map((code) => (
                    <BlockedPill key={code} code={code} onRemove={() => toggleCountry(code)} />
                  ))}
                </div>
              )}
              {blockedSet.size === 0 && (
                <p className="text-xs text-foreground/25 mt-3">No countries currently blocked.</p>
              )}
            </div>
          </div>

          {/* Feature Flags */}
          <div className="bg-card border border-border rounded-2xl px-5">
            <div className="py-4 border-b border-border">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-foreground/30">Feature Flags</h3>
            </div>
            <Toggle label="Biometric Authentication" description="Allow users to use fingerprint / face ID"
              enabled={draft.featureFlags.biometricEnabled} onChange={(v) => setFlag("biometricEnabled", v)} />
            <Toggle label="P2P Transfers" description="Allow peer-to-peer money transfers between users"
              enabled={draft.featureFlags.p2pEnabled} onChange={(v) => setFlag("p2pEnabled", v)} />
            <Toggle label="Push Notifications" description="Enable push notification delivery to users"
              enabled={draft.featureFlags.notificationsEnabled} onChange={(v) => setFlag("notificationsEnabled", v)} />
          </div>

          {/* Contact Info */}
          <div className="bg-card border border-border rounded-2xl px-5">
            <div className="py-4 border-b border-border">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-foreground/30">Contact Information</h3>
            </div>
            <TextInput label="Support Email" description="Customer-facing support email address"
              value={draft.supportEmail} onChange={(v) => set("supportEmail", v)} />
            <TextInput label="Support Phone" description="Customer-facing support phone number"
              value={draft.supportPhone} onChange={(v) => set("supportPhone", v)} />
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => saveMutation.mutate()}
              disabled={!hasChanges || saveMutation.isPending}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#B7EE7A] text-black text-sm font-semibold hover:bg-[#B7EE7A]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {saveMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saveMutation.isPending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
