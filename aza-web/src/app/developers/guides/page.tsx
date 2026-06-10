'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ChevronRight,
  Copy,
  Check,
  ExternalLink,
  Menu,
  X,
  Code,
  AlertTriangle,
  Info,
} from 'lucide-react';

type CodeTab = 'curl' | 'js' | 'python' | 'java';

interface DocArticle {
  id: string;
  title: string;
  category: string;
  subtitle: string;
  lastUpdated: string;
  description: string;
  content: React.ReactNode;
  codeSnippets: { curl: string; js: string; python: string; java: string };
}

export default function GuidesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white font-sans antialiased text-gray-900">
        <p className="text-sm font-medium text-gray-500 font-mono">Loading documentation...</p>
      </div>
    }>
      <GuidesContent />
    </Suspense>
  );
}

function GuidesContent() {
  const searchParams = useSearchParams();
  const [activeDoc, setActiveDoc] = useState<string>('intro');
  const [activeCodeTab, setActiveCodeTab] = useState<CodeTab>('curl');
  const [copied, setCopied] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const docParam = searchParams.get('doc');
    if (docParam && docMap[docParam]) {
      setActiveDoc(docParam);
    }
  }, [searchParams]);

  const handleSelectDoc = (docId: string) => {
    setActiveDoc(docId);
    setActiveCodeTab('curl');
    setMobileMenuOpen(false);
    const newUrl = `${window.location.pathname}?doc=${docId}`;
    window.history.pushState({ path: newUrl }, '', newUrl);
  };

  const currentDoc = docMap[activeDoc] || docMap['intro'];

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-white font-sans antialiased text-gray-900">
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-[#0e2a0e] text-white border-b border-white/10 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black bg-[#B7EE7A] text-[#174717]">A</span>
          <span className="font-extrabold text-sm tracking-tight">aza developers</span>
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-1 text-white/80 hover:text-white" aria-label="Toggle navigation">
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`w-full md:w-64 flex-shrink-0 flex flex-col bg-[#0e2a0e] text-white border-r border-[#174717] md:sticky md:top-0 md:h-screen overflow-y-auto z-40 transition-all duration-200 ${mobileMenuOpen ? 'fixed inset-x-0 bottom-0 top-[53px]' : 'hidden md:flex'}`}>
        <div className="hidden md:block p-5 border-b border-white/5">
          <Link href="/" className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black bg-[#B7EE7A] text-[#174717]">A</span>
            <div>
              <p className="font-extrabold text-sm leading-none tracking-tight">aza</p>
              <p className="text-[10px] font-bold tracking-wider text-[#B7EE7A]/60 mt-1 uppercase">Developer Guides</p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-4 flex flex-col gap-5">
          {navigationGroups.map((group) => (
            <div key={group.title} className="flex flex-col gap-0.5">
              <h2 className="text-[10px] font-extrabold uppercase tracking-wider text-[#B7EE7A]/40 px-2 py-1 mb-0.5">{group.title}</h2>
              {group.items.map((item) => {
                const isActive = activeDoc === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectDoc(item.id)}
                    className={`w-full text-left px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center justify-between ${isActive ? 'bg-white/10 text-white font-semibold' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
                  >
                    {item.label}
                    {isActive && <ChevronRight size={12} className="text-[#B7EE7A]" />}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5 bg-[#0a1f0a] flex flex-col gap-2">
          <Link href="/developers/api-explorer" className="flex items-center justify-between text-xs font-medium text-[#B7EE7A] hover:underline">
            <span>API Reference Explorer</span>
            <ExternalLink size={12} />
          </Link>
          <div className="text-[10px] text-white/30 font-mono mt-1">API Version: v1</div>
        </div>
      </aside>

      {/* Main Panel */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 bg-white border-b border-gray-200 z-30 h-14 flex items-center justify-between px-6">
          <span className="text-xs text-gray-500 font-mono hidden md:inline">
            docs / guides / {currentDoc.category.toLowerCase().replace(/ /g, '-')}
          </span>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <button onClick={() => handleSelectDoc('intro')} className="px-3 py-1.5 border-b-2 border-[#174717] text-[#174717]">Guides</button>
            <Link href="/developers/api-explorer" className="px-3 py-1.5 text-gray-500 hover:text-gray-900 border-b-2 border-transparent transition-colors">API Reference</Link>
            <Link href="/developers/login" className="ml-2 px-3 py-1.5 bg-[#174717] text-white hover:bg-[#205c20] rounded-md transition-colors">Dashboard</Link>
          </div>
        </header>

        <div className="flex-1 flex flex-col xl:flex-row overflow-y-auto">
          <main className="flex-1 px-6 py-8 max-w-3xl">
            <div className="border-b border-gray-100 pb-6 mb-6">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#2e7d2e] bg-[#2e7d2e]/10 px-2.5 py-1 rounded">
                {currentDoc.category}
              </span>
              <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mt-3">{currentDoc.title}</h1>
              <p className="text-sm text-gray-500 mt-2 font-medium">
                {currentDoc.subtitle} &middot; Last updated {currentDoc.lastUpdated}
              </p>
            </div>
            <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed space-y-6">
              <p className="text-base text-gray-600">{currentDoc.description}</p>
              {currentDoc.content}
            </div>
          </main>

          {/* Code Panel */}
          <aside className="w-full xl:w-[420px] bg-[#111827] text-[#e5e7eb] flex-shrink-0 flex flex-col border-t xl:border-t-0 xl:border-l border-gray-800 xl:sticky xl:top-14 xl:h-[calc(100vh-56px)] overflow-y-auto font-mono">
            <div className="flex items-center justify-between px-4 py-2 bg-[#1f2937] border-b border-gray-800">
              <div className="flex items-center gap-1">
                {(['curl', 'js', 'python', 'java'] as CodeTab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveCodeTab(tab)}
                    className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${activeCodeTab === tab ? 'bg-[#111827] text-white border border-gray-700' : 'text-gray-400 hover:text-white'}`}
                  >
                    {tab === 'curl' ? 'cURL' : tab === 'js' ? 'Node.js' : tab === 'python' ? 'Python' : 'Java'}
                  </button>
                ))}
              </div>
              <button
                onClick={() => copyCode(currentDoc.codeSnippets[activeCodeTab])}
                className="flex items-center gap-1 px-2.5 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 transition-colors border border-transparent hover:border-gray-700"
              >
                {copied ? (<><Check size={12} className="text-[#B7EE7A]" /><span className="text-[#B7EE7A]">Copied</span></>) : (<><Copy size={12} /><span>Copy</span></>)}
              </button>
            </div>
            <div className="flex-1 p-5 overflow-auto text-xs leading-relaxed bg-[#0b0f19]">
              <pre className="whitespace-pre-wrap break-all font-mono text-[#f3f4f6]">
                <code>{currentDoc.codeSnippets[activeCodeTab]}</code>
              </pre>
            </div>
            <div className="p-4 bg-[#1f2937] border-t border-gray-800 text-[10px] text-gray-400 leading-normal flex items-start gap-2">
              <Code size={13} className="text-[#B7EE7A] flex-shrink-0 mt-0.5" />
              <span>Authenticate using your API key (<code>sk_live_...</code> or <code>sk_test_...</code>) from the merchant dashboard. Pass it as the <code>X-Api-Key</code> header.</span>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 p-4 bg-[#f0f9ff] border border-[#bae6fd] rounded-lg text-sm text-[#0369a1]">
      <Info size={16} className="flex-shrink-0 mt-0.5" />
      <div>{children}</div>
    </div>
  );
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 p-4 bg-[#fef3c7] border border-[#fde68a] rounded-lg text-sm text-[#78350f]">
      <AlertTriangle size={16} className="flex-shrink-0 mt-0.5 text-amber-600" />
      <div>{children}</div>
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs text-left border-collapse border border-gray-200">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {headers.map((h) => <th key={h} className="p-2.5 font-bold text-gray-800">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i < rows.length - 1 ? 'border-b border-gray-100' : ''}>
              {row.map((cell, j) => (
                <td key={j} className={`p-2.5 ${j === 0 ? 'font-semibold text-gray-700' : j === 1 ? 'font-mono text-gray-600' : 'text-gray-600'}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Endpoint({ method, path }: { method: string; path: string }) {
  const colors: Record<string, string> = { GET: 'bg-blue-100 text-blue-800', POST: 'bg-green-100 text-green-800', DELETE: 'bg-red-100 text-red-800', PATCH: 'bg-yellow-100 text-yellow-700' };
  return (
    <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg font-mono text-xs">
      <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${colors[method] ?? 'bg-gray-200 text-gray-700'}`}>{method}</span>
      <span className="text-gray-700">{path}</span>
    </div>
  );
}

// ── Navigation ────────────────────────────────────────────────────────────────

const navigationGroups = [
  {
    title: 'Getting Started',
    items: [
      { id: 'intro',   label: 'Introduction' },
      { id: 'auth',    label: 'Authentication & API Keys' },
      { id: 'sdks',    label: 'SDKs & Libraries' },
    ],
  },
  {
    title: 'Accept Payments',
    items: [
      { id: 'checkout',        label: 'Checkout Sessions' },
      { id: 'payment-links',   label: 'Payment Links & QR' },
      { id: 'invoices',        label: 'Invoices' },
      { id: 'discount-codes',  label: 'Discount Codes' },
    ],
  },
  {
    title: 'Manage Business',
    items: [
      { id: 'customers',  label: 'Customers' },
      { id: 'disputes',   label: 'Disputes & Refunds' },
      { id: 'settlements', label: 'Settlements' },
    ],
  },
  {
    title: 'Payouts',
    items: [
      { id: 'payouts', label: 'Merchant Payouts' },
    ],
  },
  {
    title: 'Webhooks',
    items: [
      { id: 'webhooks-overview',    label: 'Webhook Setup' },
      { id: 'webhooks-signatures',  label: 'Signature Verification' },
    ],
  },
  {
    title: 'Reference',
    items: [
      { id: 'errors',          label: 'Error Codes' },
      { id: 'response-format', label: 'Response Format' },
      { id: 'changelog',       label: 'Changelog' },
    ],
  },
];

// ── Doc Articles ──────────────────────────────────────────────────────────────

const BASE = 'https://api.aza.systems';

const docMap: Record<string, DocArticle> = {

  // ── Introduction ────────────────────────────────────────────────────────────
  intro: {
    id: 'intro',
    category: 'Getting Started',
    title: 'Introduction',
    subtitle: 'Build on Aza\'s payments infrastructure',
    lastUpdated: 'May 2026',
    description: 'Aza is a mobile-first payments platform for Ghana and West Africa. As a merchant, you can accept customer payments, manage invoices and discount codes, receive automated payouts, and react to real-time events — all via a single REST API.',
    content: (
      <div className="space-y-6">
        <h3 className="text-base font-bold text-gray-900">What you can build</h3>
        <ul className="list-disc pl-5 space-y-1.5 text-sm">
          <li><strong>Accept payments</strong> — create hosted checkout sessions that customers pay inside the Aza app.</li>
          <li><strong>Payment links &amp; QR codes</strong> — share a static link or QR that routes customers directly to your storefront.</li>
          <li><strong>Invoices</strong> — send itemised payment requests to named customers by email.</li>
          <li><strong>Discount codes</strong> — create percentage or fixed-amount promotions redeemable at checkout.</li>
          <li><strong>Payouts</strong> — move your settled balance to your linked bank account on demand.</li>
          <li><strong>Webhooks</strong> — receive real-time HTTP callbacks when payment events occur.</li>
        </ul>

        <h3 className="text-base font-bold text-gray-900">Base URL</h3>
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg font-mono text-xs text-gray-700">
          {BASE}
        </div>
        <p className="text-sm">All endpoints are under <code>/api/v1/merchant/</code> and require your API key. There is a single production environment — test keys (<code>sk_test_...</code>) behave identically to live keys but do not move real money.</p>

        <Note>
          <strong>Currency:</strong> The default currency is <strong>GHS (Ghana Cedi)</strong>. All amounts in request and response bodies are in GHS unless noted.
        </Note>

        <h3 className="text-base font-bold text-gray-900">Integration steps</h3>
        <ol className="list-decimal pl-5 space-y-1.5 text-sm">
          <li>Register your business at <a href="https://merchants.aza.systems/onboarding" className="text-[#2e7d2e] underline">merchants.aza.systems</a> and complete KYB.</li>
          <li>Generate an API key from <strong>Settings → API Keys</strong>.</li>
          <li>Create a checkout session via <code>POST /api/v1/merchant/sessions</code>.</li>
          <li>Listen for the <code>session.completed</code> webhook to confirm payment.</li>
        </ol>
      </div>
    ),
    codeSnippets: {
      curl: `# Verify your API key and fetch your merchant profile
curl -X GET ${BASE}/api/v1/merchant/profile \\
  -H "X-Api-Key: sk_live_YOUR_KEY"`,
      js: `// Fetch your merchant profile
const res = await fetch('${BASE}/api/v1/merchant/profile', {
  headers: { 'X-Api-Key': 'sk_live_YOUR_KEY' }
});
const { data } = await res.json();
console.log(data.businessName, data.status);`,
      python: `import requests

resp = requests.get(
    '${BASE}/api/v1/merchant/profile',
    headers={'X-Api-Key': 'sk_live_YOUR_KEY'}
)
data = resp.json()['data']
print(data['businessName'], data['status'])`,
      java: `import java.net.URI;
import java.net.http.*;

// Fetch your merchant profile
var client = HttpClient.newHttpClient();
var req = HttpRequest.newBuilder()
    .uri(URI.create("https://api.aza.systems/api/v1/merchant/profile"))
    .header("X-Api-Key", "sk_live_YOUR_KEY")
    .GET()
    .build();

var res = client.send(req, HttpResponse.BodyHandlers.ofString());
System.out.println(res.body());
// {"success":true,"data":{"businessName":"...","status":"ACTIVE"}}`,
    },
  },

  // ── Authentication & API Keys ────────────────────────────────────────────────
  auth: {
    id: 'auth',
    category: 'Getting Started',
    title: 'Authentication & API Keys',
    subtitle: 'Secure every request with your merchant API key',
    lastUpdated: 'May 2026',
    description: 'Every request to the Aza merchant API must include your API key in the X-Api-Key header. Keys are scoped to your merchant account and can be rotated at any time from the dashboard.',
    content: (
      <div className="space-y-6">
        <h3 className="text-base font-bold text-gray-900">Header format</h3>
        <Table
          headers={['Header', 'Value']}
          rows={[
            ['X-Api-Key', 'sk_live_...  or  sk_test_...'],
          ]}
        />

        <h3 className="text-base font-bold text-gray-900">Key types</h3>
        <Table
          headers={['Prefix', 'Environment', 'Effect']}
          rows={[
            ['sk_test_...', 'Test', 'Full API access; no real money moves'],
            ['sk_live_...', 'Live', 'Real transactions and payouts'],
          ]}
        />

        <Warn>
          <strong>Keep keys secret.</strong> Never embed live keys in mobile apps or client-side JavaScript. Store them as environment variables on your server.
        </Warn>

        <h3 className="text-base font-bold text-gray-900">Managing keys via API</h3>
        <Endpoint method="GET"  path="/api/v1/merchant/api-keys" />
        <Endpoint method="POST" path="/api/v1/merchant/api-keys" />

        <p className="text-sm">POST body accepts an optional <code>name</code> string to label the key. The secret value is returned <strong>once</strong> at creation — store it immediately.</p>

        <Table
          headers={['Field', 'Type', 'Description']}
          rows={[
            ['name', 'string (optional)', 'Human-readable label, e.g. "Production server"'],
          ]}
        />

        <h3 className="text-base font-bold text-gray-900">Example response</h3>
        <pre className="p-3 bg-gray-50 border border-gray-200 rounded-lg font-mono text-[11px] text-gray-700 overflow-x-auto">{`{
  "success": true,
  "data": {
    "id": "key_abc123",
    "name": "Production server",
    "keyPrefix": "sk_live_Ab1c",
    "secret": "sk_live_Ab1cXXXXXXXXXXXX",
    "createdAt": "2026-05-01T10:00:00Z"
  }
}`}</pre>
      </div>
    ),
    codeSnippets: {
      curl: `# List all API keys
curl -X GET ${BASE}/api/v1/merchant/api-keys \\
  -H "X-Api-Key: sk_live_YOUR_KEY"

# Create a new API key
curl -X POST ${BASE}/api/v1/merchant/api-keys \\
  -H "X-Api-Key: sk_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "Production server"}'`,
      js: `// List API keys
const list = await fetch('${BASE}/api/v1/merchant/api-keys', {
  headers: { 'X-Api-Key': 'sk_live_YOUR_KEY' }
}).then(r => r.json());

// Create a new key
const created = await fetch('${BASE}/api/v1/merchant/api-keys', {
  method: 'POST',
  headers: {
    'X-Api-Key': 'sk_live_YOUR_KEY',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ name: 'Production server' }),
}).then(r => r.json());

console.log(created.data.secret); // store this immediately`,
      python: `import requests

BASE = '${BASE}'
HEADERS = {'X-Api-Key': 'sk_live_YOUR_KEY'}

# List API keys
keys = requests.get(f'{BASE}/api/v1/merchant/api-keys', headers=HEADERS).json()

# Create a new key
new_key = requests.post(
    f'{BASE}/api/v1/merchant/api-keys',
    headers={**HEADERS, 'Content-Type': 'application/json'},
    json={'name': 'Production server'}
).json()

print(new_key['data']['secret'])  # store immediately`,
      java: `import java.net.URI;
import java.net.http.*;

var client = HttpClient.newHttpClient();

// List API keys
var listReq = HttpRequest.newBuilder()
    .uri(URI.create("https://api.aza.systems/api/v1/merchant/api-keys"))
    .header("X-Api-Key", "sk_live_YOUR_KEY")
    .GET().build();
System.out.println(client.send(listReq, HttpResponse.BodyHandlers.ofString()).body());

// Create a new key
String createBody = "{\"name\": \"Production server\"}";
var createReq = HttpRequest.newBuilder()
    .uri(URI.create("https://api.aza.systems/api/v1/merchant/api-keys"))
    .header("X-Api-Key", "sk_live_YOUR_KEY")
    .header("Content-Type", "application/json")
    .POST(HttpRequest.BodyPublishers.ofString(createBody))
    .build();
var createRes = client.send(createReq, HttpResponse.BodyHandlers.ofString());
System.out.println(createRes.body()); // contains secret — store immediately`,
    },
  },

  // ── Checkout Sessions ────────────────────────────────────────────────────────
  checkout: {
    id: 'checkout',
    category: 'Accept Payments',
    title: 'Checkout Sessions',
    subtitle: 'Accept customer payments via the Aza app',
    lastUpdated: 'May 2026',
    description: 'A checkout session represents a single payment request. When created, the customer opens the session URL in the Aza app and approves the payment with their PIN. You receive a webhook when it completes.',
    content: (
      <div className="space-y-6">
        <h3 className="text-base font-bold text-gray-900">Create a session</h3>
        <Endpoint method="POST" path="/api/v1/merchant/sessions" />
        <Table
          headers={['Field', 'Type', 'Required', 'Description']}
          rows={[
            ['amount',      'decimal', 'Yes', 'Amount in GHS, e.g. 50.00'],
            ['description', 'string',  'No',  'Note shown to the customer at checkout'],
            ['reference',   'string',  'No',  'Your own idempotency reference'],
          ]}
        />

        <h3 className="text-base font-bold text-gray-900">Session response</h3>
        <pre className="p-3 bg-gray-50 border border-gray-200 rounded-lg font-mono text-[11px] text-gray-700 overflow-x-auto">{`{
  "success": true,
  "data": {
    "id": "sess_7f3a9b",
    "status": "PENDING",
    "amount": 50.00,
    "currency": "GHS",
    "checkoutUrl": "https://pay.aza.systems/c/sess_7f3a9b",
    "deepLink": "aza://checkout/sess_7f3a9b",
    "expiresAt": "2026-05-27T11:30:00Z",
    "createdAt": "2026-05-27T11:00:00Z"
  }
}`}</pre>

        <h3 className="text-base font-bold text-gray-900">Retrieve a session</h3>
        <Endpoint method="GET" path="/api/v1/merchant/sessions/{id}" />

        <h3 className="text-base font-bold text-gray-900">List sessions</h3>
        <Endpoint method="GET" path="/api/v1/merchant/sessions?page=0&size=20" />

        <h3 className="text-base font-bold text-gray-900">Session statuses</h3>
        <Table
          headers={['Status', 'Description']}
          rows={[
            ['PENDING',   'Created, waiting for customer payment'],
            ['COMPLETED', 'Payment received successfully'],
            ['EXPIRED',   'Session timed out (30 minutes)'],
            ['CANCELLED', 'Cancelled before payment'],
            ['REFUNDED',  'Full or partial refund issued'],
          ]}
        />

        <Note>
          Redirect or deep-link the customer to <code>checkoutUrl</code> or <code>deepLink</code>. On mobile, prefer the deep link to open the Aza app directly.
        </Note>
      </div>
    ),
    codeSnippets: {
      curl: `# Create a checkout session
curl -X POST ${BASE}/api/v1/merchant/sessions \\
  -H "X-Api-Key: sk_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 50.00,
    "description": "Order #1042"
  }'

# Retrieve a session
curl -X GET ${BASE}/api/v1/merchant/sessions/sess_7f3a9b \\
  -H "X-Api-Key: sk_live_YOUR_KEY"`,
      js: `const BASE = '${BASE}';
const KEY  = 'sk_live_YOUR_KEY';

// Create a session
const { data: session } = await fetch(\`\${BASE}/api/v1/merchant/sessions\`, {
  method: 'POST',
  headers: { 'X-Api-Key': KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ amount: 50.00, description: 'Order #1042' }),
}).then(r => r.json());

console.log(session.checkoutUrl);
// Redirect customer or show QR

// Poll status
const { data: status } = await fetch(
  \`\${BASE}/api/v1/merchant/sessions/\${session.id}\`,
  { headers: { 'X-Api-Key': KEY } }
).then(r => r.json());

console.log(status.status); // 'COMPLETED'`,
      python: `import requests

BASE = '${BASE}'
HEADERS = {'X-Api-Key': 'sk_live_YOUR_KEY', 'Content-Type': 'application/json'}

# Create a session
session = requests.post(
    f'{BASE}/api/v1/merchant/sessions',
    headers=HEADERS,
    json={'amount': 50.00, 'description': 'Order #1042'}
).json()['data']

print(session['checkoutUrl'])

# Poll status
status = requests.get(
    f'{BASE}/api/v1/merchant/sessions/{session["id"]}',
    headers=HEADERS
).json()['data']

print(status['status'])  # 'COMPLETED'`,
      java: `import java.net.URI;
import java.net.http.*;

var client = HttpClient.newHttpClient();
String BASE = "https://api.aza.systems";

// Create a session
String body = "{\"amount\": 50.00, \"description\": \"Order #1042\"}";
var res = client.send(
    HttpRequest.newBuilder()
        .uri(URI.create(BASE + "/api/v1/merchant/sessions"))
        .header("X-Api-Key", "sk_live_YOUR_KEY")
        .header("Content-Type", "application/json")
        .POST(HttpRequest.BodyPublishers.ofString(body)).build(),
    HttpResponse.BodyHandlers.ofString());
System.out.println(res.body()); // contains checkoutUrl and deepLink

// Poll session status
var statusRes = client.send(
    HttpRequest.newBuilder()
        .uri(URI.create(BASE + "/api/v1/merchant/sessions/sess_7f3a9b"))
        .header("X-Api-Key", "sk_live_YOUR_KEY")
        .GET().build(),
    HttpResponse.BodyHandlers.ofString());
System.out.println(statusRes.body()); // status: COMPLETED`,
    },
  },

  // ── Payment Links & QR ──────────────────────────────────────────────────────
  'payment-links': {
    id: 'payment-links',
    category: 'Accept Payments',
    title: 'Payment Links & QR Codes',
    subtitle: 'Share a permanent link or QR to your storefront',
    lastUpdated: 'May 2026',
    description: 'Every Aza merchant gets a permanent payment page at aza.systems/pay/{handle}. Print the QR code in your store, put the link on your website, or embed it anywhere — customers can pay you without any code on your side.',
    content: (
      <div className="space-y-6">
        <h3 className="text-base font-bold text-gray-900">Your payment page URL</h3>
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg font-mono text-xs text-gray-700">
          https://aza.systems/pay/<span className="text-[#2e7d2e]">{'{businessHandle}'}</span>
        </div>
        <p className="text-sm">This page is live as soon as your merchant account is approved. It shows your business name, logo, and a QR code the customer scans with the Aza app.</p>

        <h3 className="text-base font-bold text-gray-900">Deep link for in-app routing</h3>
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg font-mono text-xs text-gray-700">
          aza://pay/<span className="text-[#2e7d2e]">{'{businessHandle}'}</span>
        </div>

        <h3 className="text-base font-bold text-gray-900">Generate a QR code image</h3>
        <p className="text-sm">Use the free QR server API to generate a PNG you can embed in receipts, menus, or posters:</p>
        <pre className="p-3 bg-gray-50 border border-gray-200 rounded-lg font-mono text-[11px] text-gray-700 overflow-x-auto">{`https://api.qrserver.com/v1/create-qr-code/
  ?size=300x300
  &data=https://aza.systems/pay/jumpspaces
  &margin=2`}</pre>

        <h3 className="text-base font-bold text-gray-900">Fetch your public profile</h3>
        <p className="text-sm">The public endpoint requires no authentication — useful for embedding merchant info on your own website:</p>
        <Endpoint method="GET" path="/api/v1/merchant/public/{handle}" />

        <Note>
          The static payment page does not specify an amount. To request a specific amount, use a <strong>Checkout Session</strong> instead.
        </Note>
      </div>
    ),
    codeSnippets: {
      curl: `# Fetch your public merchant profile (no auth required)
curl -X GET ${BASE}/api/v1/merchant/public/jumpspaces

# Example response
# {
#   "success": true,
#   "data": {
#     "businessHandle": "jumpspaces",
#     "businessName": "Jumpspaces",
#     "category": "FINANCE",
#     "currency": "GHS",
#     "status": "ACTIVE"
#   }
# }`,
      js: `// Build the payment page URL for your handle
const handle = 'jumpspaces';
const paymentPageUrl = \`https://aza.systems/pay/\${handle}\`;
const deepLink       = \`aza://pay/\${handle}\`;

// QR code image URL (embed in <img>)
const qrUrl = \`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=\${encodeURIComponent(paymentPageUrl)}&margin=2\`;

// Fetch public profile
const { data } = await fetch(
  \`${BASE}/api/v1/merchant/public/\${handle}\`
).then(r => r.json());

console.log(data.businessName, data.status);`,
      python: `import requests
from urllib.parse import quote

handle = 'jumpspaces'
payment_url = f'https://aza.systems/pay/{handle}'
deep_link   = f'aza://pay/{handle}'

# QR code image URL
qr_url = f'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data={quote(payment_url)}&margin=2'

# Fetch public profile (no auth)
profile = requests.get(
    f'${BASE}/api/v1/merchant/public/{handle}'
).json()['data']

print(profile['businessName'], profile['status'])`,
      java: `import java.net.URI;
import java.net.URLEncoder;
import java.net.http.*;
import java.nio.charset.StandardCharsets;

String handle     = "jumpspaces";
String paymentUrl = "https://aza.systems/pay/" + handle;
String deepLink   = "aza://pay/" + handle;
String qrUrl      = "https://api.qrserver.com/v1/create-qr-code/?size=300x300"
    + "&data=" + URLEncoder.encode(paymentUrl, StandardCharsets.UTF_8) + "&margin=2";

// Fetch public profile (no auth required)
var client = HttpClient.newHttpClient();
var res = client.send(
    HttpRequest.newBuilder()
        .uri(URI.create("https://api.aza.systems/api/v1/merchant/public/" + handle))
        .GET().build(),
    HttpResponse.BodyHandlers.ofString());
System.out.println(res.body()); // businessName, status`,
    },
  },

  // ── Invoices ─────────────────────────────────────────────────────────────────
  invoices: {
    id: 'invoices',
    category: 'Accept Payments',
    title: 'Invoices',
    subtitle: 'Send payment requests to customers by email',
    lastUpdated: 'May 2026',
    description: 'Invoices let you bill named customers directly. Once sent, the customer receives an email with a payment link. You can track status from DRAFT through to PAID.',
    content: (
      <div className="space-y-6">
        <h3 className="text-base font-bold text-gray-900">Endpoints</h3>
        <div className="space-y-2">
          <Endpoint method="GET"    path="/api/v1/merchant/invoices?page=0&size=20" />
          <Endpoint method="POST"   path="/api/v1/merchant/invoices" />
          <Endpoint method="POST"   path="/api/v1/merchant/invoices/{id}/send" />
          <Endpoint method="DELETE" path="/api/v1/merchant/invoices/{id}" />
        </div>

        <h3 className="text-base font-bold text-gray-900">Create invoice fields</h3>
        <Table
          headers={['Field', 'Type', 'Required', 'Description']}
          rows={[
            ['customerName',  'string',  'Yes', 'Full name of the customer'],
            ['customerEmail', 'string',  'Yes', 'Email address to deliver the invoice'],
            ['amount',        'decimal', 'Yes', 'Amount in GHS'],
            ['description',   'string',  'No',  'Line-item or service description'],
            ['dueDate',       'string',  'No',  'ISO 8601 date, e.g. "2026-06-30"'],
            ['currency',      'string',  'No',  'Defaults to "GHS"'],
          ]}
        />

        <h3 className="text-base font-bold text-gray-900">Invoice lifecycle</h3>
        <Table
          headers={['Status', 'Description']}
          rows={[
            ['DRAFT',     'Created but not yet sent to the customer'],
            ['SENT',      'Email dispatched; awaiting payment'],
            ['PAID',      'Customer has completed payment'],
            ['CANCELLED', 'Invoice voided before payment'],
            ['OVERDUE',   'Due date passed with no payment'],
          ]}
        />

        <Note>
          Call <code>POST /invoices/{'{id}'}/send</code> to transition from <strong>DRAFT → SENT</strong> and trigger the customer email. Calling DELETE on a DRAFT or SENT invoice cancels it.
        </Note>
      </div>
    ),
    codeSnippets: {
      curl: `# Create a draft invoice
curl -X POST ${BASE}/api/v1/merchant/invoices \\
  -H "X-Api-Key: sk_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "customerName": "Kwame Mensah",
    "customerEmail": "kwame@example.com",
    "amount": 250.00,
    "description": "Web design services — May 2026",
    "dueDate": "2026-06-15"
  }'

# Send the invoice (triggers customer email)
curl -X POST ${BASE}/api/v1/merchant/invoices/inv_abc123/send \\
  -H "X-Api-Key: sk_live_YOUR_KEY"

# Cancel an invoice
curl -X DELETE ${BASE}/api/v1/merchant/invoices/inv_abc123 \\
  -H "X-Api-Key: sk_live_YOUR_KEY"`,
      js: `const BASE = '${BASE}';
const HEADERS = { 'X-Api-Key': 'sk_live_YOUR_KEY', 'Content-Type': 'application/json' };

// Create invoice
const { data: inv } = await fetch(\`\${BASE}/api/v1/merchant/invoices\`, {
  method: 'POST',
  headers: HEADERS,
  body: JSON.stringify({
    customerName: 'Kwame Mensah',
    customerEmail: 'kwame@example.com',
    amount: 250.00,
    description: 'Web design services — May 2026',
    dueDate: '2026-06-15',
  }),
}).then(r => r.json());

// Send it
await fetch(\`\${BASE}/api/v1/merchant/invoices/\${inv.id}/send\`, {
  method: 'POST',
  headers: HEADERS,
});

console.log('Invoice sent:', inv.id);`,
      python: `import requests

BASE    = '${BASE}'
HEADERS = {'X-Api-Key': 'sk_live_YOUR_KEY', 'Content-Type': 'application/json'}

# Create invoice
inv = requests.post(
    f'{BASE}/api/v1/merchant/invoices',
    headers=HEADERS,
    json={
        'customerName': 'Kwame Mensah',
        'customerEmail': 'kwame@example.com',
        'amount': 250.00,
        'description': 'Web design services — May 2026',
        'dueDate': '2026-06-15',
    }
).json()['data']

# Send it
requests.post(
    f'{BASE}/api/v1/merchant/invoices/{inv["id"]}/send',
    headers=HEADERS
)
print('Invoice sent:', inv['id'])`,
      java: `import java.net.URI;
import java.net.http.*;

var client = HttpClient.newHttpClient();
String BASE = "https://api.aza.systems";

// Create invoice
String body = "{\"customerName\":\"Kwame Mensah\",\"customerEmail\":\"kwame@example.com\","
    + "\"amount\":250.00,\"description\":\"Web design services\",\"dueDate\":\"2026-06-15\"}";
var inv = client.send(
    HttpRequest.newBuilder()
        .uri(URI.create(BASE + "/api/v1/merchant/invoices"))
        .header("X-Api-Key", "sk_live_YOUR_KEY")
        .header("Content-Type", "application/json")
        .POST(HttpRequest.BodyPublishers.ofString(body)).build(),
    HttpResponse.BodyHandlers.ofString());
System.out.println("Created: " + inv.body());

// Send the invoice (triggers customer email)
client.send(
    HttpRequest.newBuilder()
        .uri(URI.create(BASE + "/api/v1/merchant/invoices/inv_abc123/send"))
        .header("X-Api-Key", "sk_live_YOUR_KEY")
        .POST(HttpRequest.BodyPublishers.noBody()).build(),
    HttpResponse.BodyHandlers.ofString());`,
    },
  },

  // ── Discount Codes ───────────────────────────────────────────────────────────
  'discount-codes': {
    id: 'discount-codes',
    category: 'Accept Payments',
    title: 'Discount Codes',
    subtitle: 'Create promotions redeemable at checkout',
    lastUpdated: 'May 2026',
    description: 'Discount codes let customers reduce the amount they pay at checkout. You can create percentage-based or fixed-amount codes, optionally cap the number of uses, and set an expiry date.',
    content: (
      <div className="space-y-6">
        <h3 className="text-base font-bold text-gray-900">Endpoints</h3>
        <div className="space-y-2">
          <Endpoint method="GET"  path="/api/v1/merchant/discount-codes?page=0&size=20" />
          <Endpoint method="POST" path="/api/v1/merchant/discount-codes" />
        </div>

        <h3 className="text-base font-bold text-gray-900">Create discount code fields</h3>
        <Table
          headers={['Field', 'Type', 'Required', 'Description']}
          rows={[
            ['code',      'string',            'Yes', 'Uppercase code, min 3 chars, e.g. "SAVE20"'],
            ['type',      '"PERCENTAGE"|"FIXED"', 'Yes', 'How the discount is calculated'],
            ['value',     'decimal',           'Yes', 'Percentage (0–100) or fixed GHS amount'],
            ['maxUses',   'integer',           'No',  'Maximum redemptions. Omit for unlimited'],
            ['expiresAt', 'string (ISO 8601)', 'No',  'Expiry datetime, e.g. "2026-12-31T23:59:00Z"'],
          ]}
        />

        <h3 className="text-base font-bold text-gray-900">Example response</h3>
        <pre className="p-3 bg-gray-50 border border-gray-200 rounded-lg font-mono text-[11px] text-gray-700 overflow-x-auto">{`{
  "success": true,
  "data": {
    "id": "dc_xyz789",
    "code": "SAVE20",
    "type": "PERCENTAGE",
    "value": 20,
    "maxUses": 100,
    "usedCount": 0,
    "isActive": true,
    "expiresAt": null,
    "createdAt": "2026-05-27T09:00:00Z"
  }
}`}</pre>
      </div>
    ),
    codeSnippets: {
      curl: `# Create a 20% discount code (max 100 uses)
curl -X POST ${BASE}/api/v1/merchant/discount-codes \\
  -H "X-Api-Key: sk_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "code": "SAVE20",
    "type": "PERCENTAGE",
    "value": 20,
    "maxUses": 100
  }'

# Create a fixed GH₵10 off code
curl -X POST ${BASE}/api/v1/merchant/discount-codes \\
  -H "X-Api-Key: sk_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "code": "OFF10",
    "type": "FIXED",
    "value": 10
  }'

# List all codes
curl -X GET "${BASE}/api/v1/merchant/discount-codes?page=0&size=20" \\
  -H "X-Api-Key: sk_live_YOUR_KEY"`,
      js: `const BASE    = '${BASE}';
const HEADERS = { 'X-Api-Key': 'sk_live_YOUR_KEY', 'Content-Type': 'application/json' };

// Create 20% off code
const { data: code } = await fetch(\`\${BASE}/api/v1/merchant/discount-codes\`, {
  method: 'POST',
  headers: HEADERS,
  body: JSON.stringify({
    code: 'SAVE20',
    type: 'PERCENTAGE',
    value: 20,
    maxUses: 100,
  }),
}).then(r => r.json());

console.log(code.id, code.code, code.isActive);`,
      python: `import requests

BASE    = '${BASE}'
HEADERS = {'X-Api-Key': 'sk_live_YOUR_KEY', 'Content-Type': 'application/json'}

# Create 20% off code
code = requests.post(
    f'{BASE}/api/v1/merchant/discount-codes',
    headers=HEADERS,
    json={'code': 'SAVE20', 'type': 'PERCENTAGE', 'value': 20, 'maxUses': 100}
).json()['data']

print(code['code'], code['isActive'])`,
      java: `import java.net.URI;
import java.net.http.*;

var client = HttpClient.newHttpClient();
String BASE = "https://api.aza.systems";

// Create 20% off code (max 100 uses)
String body = "{\"code\":\"SAVE20\",\"type\":\"PERCENTAGE\",\"value\":20,\"maxUses\":100}";
var res = client.send(
    HttpRequest.newBuilder()
        .uri(URI.create(BASE + "/api/v1/merchant/discount-codes"))
        .header("X-Api-Key", "sk_live_YOUR_KEY")
        .header("Content-Type", "application/json")
        .POST(HttpRequest.BodyPublishers.ofString(body)).build(),
    HttpResponse.BodyHandlers.ofString());
System.out.println(res.body());

// Create fixed GH₵10 off code
String body2 = "{\"code\":\"OFF10\",\"type\":\"FIXED\",\"value\":10}";
client.send(
    HttpRequest.newBuilder()
        .uri(URI.create(BASE + "/api/v1/merchant/discount-codes"))
        .header("X-Api-Key", "sk_live_YOUR_KEY")
        .header("Content-Type", "application/json")
        .POST(HttpRequest.BodyPublishers.ofString(body2)).build(),
    HttpResponse.BodyHandlers.ofString());

// List codes
var list = client.send(
    HttpRequest.newBuilder()
        .uri(URI.create(BASE + "/api/v1/merchant/discount-codes?page=0&size=20"))
        .header("X-Api-Key", "sk_live_YOUR_KEY")
        .GET().build(),
    HttpResponse.BodyHandlers.ofString());
System.out.println(list.body());`,
    },
  },

  // ── Customers ────────────────────────────────────────────────────────────────
  customers: {
    id: 'customers',
    category: 'Manage Business',
    title: 'Customers',
    subtitle: 'View all customers who have paid you',
    lastUpdated: 'May 2026',
    description: 'The customers endpoint returns a paginated list of every user who has completed a payment to your merchant account, along with their total spend and transaction count.',
    content: (
      <div className="space-y-6">
        <h3 className="text-base font-bold text-gray-900">Endpoint</h3>
        <Endpoint method="GET" path="/api/v1/merchant/customers?page=0&size=20" />

        <h3 className="text-base font-bold text-gray-900">Customer object</h3>
        <Table
          headers={['Field', 'Type', 'Description']}
          rows={[
            ['id',             'string',  'Customer user ID'],
            ['name',           'string',  'Customer full name'],
            ['email',          'string',  'Customer email address'],
            ['totalSpent',     'decimal', 'Cumulative GHS spent with your merchant'],
            ['paymentCount',   'integer', 'Number of completed payments'],
            ['lastPaymentAt',  'string',  'ISO 8601 timestamp of most recent payment'],
          ]}
        />

        <h3 className="text-base font-bold text-gray-900">Paginated response</h3>
        <pre className="p-3 bg-gray-50 border border-gray-200 rounded-lg font-mono text-[11px] text-gray-700 overflow-x-auto">{`{
  "success": true,
  "data": {
    "content": [ { "id": "u_1", "name": "Ama Owusu", ... } ],
    "page": 0,
    "size": 20,
    "totalElements": 142,
    "totalPages": 8
  }
}`}</pre>
      </div>
    ),
    codeSnippets: {
      curl: `# List customers (page 0, 20 per page)
curl -X GET "${BASE}/api/v1/merchant/customers?page=0&size=20" \\
  -H "X-Api-Key: sk_live_YOUR_KEY"`,
      js: `const { data } = await fetch(
  '${BASE}/api/v1/merchant/customers?page=0&size=20',
  { headers: { 'X-Api-Key': 'sk_live_YOUR_KEY' } }
).then(r => r.json());

const customers = data.content;
console.log(\`\${data.totalElements} total customers\`);
customers.forEach(c => {
  console.log(c.name, c.email, \`GH₵\${c.totalSpent}\`);
});`,
      python: `import requests

resp = requests.get(
    '${BASE}/api/v1/merchant/customers',
    params={'page': 0, 'size': 20},
    headers={'X-Api-Key': 'sk_live_YOUR_KEY'}
)
data = resp.json()['data']
print(f"{data['totalElements']} total customers")
for c in data['content']:
    print(c['name'], c['email'], f"GH₵{c['totalSpent']}")`,
      java: `import java.net.URI;
import java.net.http.*;

var client = HttpClient.newHttpClient();
var res = client.send(
    HttpRequest.newBuilder()
        .uri(URI.create("https://api.aza.systems/api/v1/merchant/customers?page=0&size=20"))
        .header("X-Api-Key", "sk_live_YOUR_KEY")
        .GET().build(),
    HttpResponse.BodyHandlers.ofString());
System.out.println(res.body());
// {"success":true,"data":{"content":[...],"totalElements":142,"totalPages":8}}`,
    },
  },

  // ── Disputes & Refunds ───────────────────────────────────────────────────────
  disputes: {
    id: 'disputes',
    category: 'Manage Business',
    title: 'Disputes & Refunds',
    subtitle: 'Handle chargeback requests and issue refunds',
    lastUpdated: 'May 2026',
    description: 'When a customer contests a payment, a dispute is opened. You can view active disputes and issue refunds directly against completed checkout sessions.',
    content: (
      <div className="space-y-6">
        <h3 className="text-base font-bold text-gray-900">Disputes endpoints</h3>
        <Endpoint method="GET" path="/api/v1/merchant/disputes?page=0&size=20" />

        <h3 className="text-base font-bold text-gray-900">Dispute object fields</h3>
        <Table
          headers={['Field', 'Type', 'Description']}
          rows={[
            ['id',          'string',  'Dispute identifier'],
            ['sessionId',   'string',  'Related checkout session'],
            ['amount',      'decimal', 'Disputed amount in GHS'],
            ['status',      'string',  'OPEN | RESOLVED | LOST'],
            ['reason',      'string',  'Customer-provided dispute reason'],
            ['openedAt',    'string',  'ISO 8601 timestamp'],
          ]}
        />

        <h3 className="text-base font-bold text-gray-900">Issue a refund</h3>
        <Endpoint method="POST" path="/api/v1/merchant/sessions/{sessionId}/refund" />
        <p className="text-sm">A full refund is issued against the original session. The refund debits your merchant balance and credits the customer wallet. Partially refunded sessions are not currently supported.</p>

        <Warn>
          Refunds are irreversible. Confirm the session ID before calling this endpoint.
        </Warn>

        <h3 className="text-base font-bold text-gray-900">Refund response</h3>
        <pre className="p-3 bg-gray-50 border border-gray-200 rounded-lg font-mono text-[11px] text-gray-700 overflow-x-auto">{`{
  "success": true,
  "data": {
    "sessionId": "sess_7f3a9b",
    "refundedAmount": 50.00,
    "status": "REFUNDED",
    "refundedAt": "2026-05-27T14:00:00Z"
  }
}`}</pre>
      </div>
    ),
    codeSnippets: {
      curl: `# List disputes
curl -X GET "${BASE}/api/v1/merchant/disputes?page=0&size=20" \\
  -H "X-Api-Key: sk_live_YOUR_KEY"

# Issue a full refund on a completed session
curl -X POST ${BASE}/api/v1/merchant/sessions/sess_7f3a9b/refund \\
  -H "X-Api-Key: sk_live_YOUR_KEY"`,
      js: `const BASE    = '${BASE}';
const HEADERS = { 'X-Api-Key': 'sk_live_YOUR_KEY' };

// List disputes
const { data } = await fetch(
  \`\${BASE}/api/v1/merchant/disputes?page=0&size=20\`,
  { headers: HEADERS }
).then(r => r.json());

console.log(\`\${data.totalElements} open disputes\`);

// Issue refund
const refund = await fetch(
  \`\${BASE}/api/v1/merchant/sessions/sess_7f3a9b/refund\`,
  { method: 'POST', headers: HEADERS }
).then(r => r.json());

console.log(refund.data.status); // 'REFUNDED'`,
      python: `import requests

BASE    = '${BASE}'
HEADERS = {'X-Api-Key': 'sk_live_YOUR_KEY'}

# List disputes
disputes = requests.get(
    f'{BASE}/api/v1/merchant/disputes',
    params={'page': 0, 'size': 20},
    headers=HEADERS
).json()['data']

# Issue refund
refund = requests.post(
    f'{BASE}/api/v1/merchant/sessions/sess_7f3a9b/refund',
    headers=HEADERS
).json()['data']

print(refund['status'])  # 'REFUNDED'`,
      java: `import java.net.URI;
import java.net.http.*;

var client = HttpClient.newHttpClient();
String BASE = "https://api.aza.systems";

// List disputes
var disputes = client.send(
    HttpRequest.newBuilder()
        .uri(URI.create(BASE + "/api/v1/merchant/disputes?page=0&size=20"))
        .header("X-Api-Key", "sk_live_YOUR_KEY")
        .GET().build(),
    HttpResponse.BodyHandlers.ofString());
System.out.println(disputes.body());

// Issue a full refund
var refund = client.send(
    HttpRequest.newBuilder()
        .uri(URI.create(BASE + "/api/v1/merchant/sessions/sess_7f3a9b/refund"))
        .header("X-Api-Key", "sk_live_YOUR_KEY")
        .POST(HttpRequest.BodyPublishers.noBody()).build(),
    HttpResponse.BodyHandlers.ofString());
System.out.println(refund.body()); // status: REFUNDED`,
    },
  },

  // ── Settlements ──────────────────────────────────────────────────────────────
  settlements: {
    id: 'settlements',
    category: 'Manage Business',
    title: 'Settlements',
    subtitle: 'View your rolling settlement reports',
    lastUpdated: 'May 2026',
    description: 'Settlements summarise the gross revenue, fees deducted, and net amount available for payout over a given settlement period. Aza settles on a daily or weekly cycle depending on your account configuration.',
    content: (
      <div className="space-y-6">
        <h3 className="text-base font-bold text-gray-900">Endpoint</h3>
        <Endpoint method="GET" path="/api/v1/merchant/settlements?page=0&size=20" />

        <h3 className="text-base font-bold text-gray-900">Settlement object</h3>
        <Table
          headers={['Field', 'Type', 'Description']}
          rows={[
            ['id',               'string',  'Settlement identifier'],
            ['periodStart',      'string',  'ISO 8601 start of the settlement window'],
            ['periodEnd',        'string',  'ISO 8601 end of the settlement window'],
            ['transactionCount', 'integer', 'Number of payments included'],
            ['grossAmount',      'decimal', 'Total payments received (GHS)'],
            ['feesDeducted',     'decimal', 'Platform fees charged (GHS)'],
            ['netAmount',        'decimal', 'grossAmount – feesDeducted'],
            ['status',           'string',  'PENDING | SETTLED'],
            ['settledAt',        'string',  'ISO 8601 timestamp when funds were released'],
          ]}
        />

        <h3 className="text-base font-bold text-gray-900">Example settlement</h3>
        <pre className="p-3 bg-gray-50 border border-gray-200 rounded-lg font-mono text-[11px] text-gray-700 overflow-x-auto">{`{
  "id": "stl_20260527",
  "periodStart": "2026-05-27T00:00:00Z",
  "periodEnd": "2026-05-27T23:59:59Z",
  "transactionCount": 38,
  "grossAmount": 4750.00,
  "feesDeducted": 142.50,
  "netAmount": 4607.50,
  "status": "SETTLED",
  "settledAt": "2026-05-28T06:00:00Z"
}`}</pre>
      </div>
    ),
    codeSnippets: {
      curl: `# List settlements
curl -X GET "${BASE}/api/v1/merchant/settlements?page=0&size=20" \\
  -H "X-Api-Key: sk_live_YOUR_KEY"`,
      js: `const { data } = await fetch(
  '${BASE}/api/v1/merchant/settlements?page=0&size=20',
  { headers: { 'X-Api-Key': 'sk_live_YOUR_KEY' } }
).then(r => r.json());

data.content.forEach(s => {
  console.log(
    s.periodStart.slice(0, 10),
    \`GH₵\${s.netAmount}\`,
    s.status
  );
});`,
      python: `import requests

resp = requests.get(
    '${BASE}/api/v1/merchant/settlements',
    params={'page': 0, 'size': 20},
    headers={'X-Api-Key': 'sk_live_YOUR_KEY'}
).json()

for s in resp['data']['content']:
    print(s['periodStart'][:10], f"GH₵{s['netAmount']}", s['status'])`,
      java: `import java.net.URI;
import java.net.http.*;

var client = HttpClient.newHttpClient();
var res = client.send(
    HttpRequest.newBuilder()
        .uri(URI.create("https://api.aza.systems/api/v1/merchant/settlements?page=0&size=20"))
        .header("X-Api-Key", "sk_live_YOUR_KEY")
        .GET().build(),
    HttpResponse.BodyHandlers.ofString());
System.out.println(res.body());
// periodStart, netAmount, status for each settlement`,
    },
  },

  // ── Merchant Payouts ─────────────────────────────────────────────────────────
  payouts: {
    id: 'payouts',
    category: 'Payouts',
    title: 'Merchant Payouts',
    subtitle: 'Withdraw your settled balance to your bank account',
    lastUpdated: 'May 2026',
    description: 'Use the payouts API to move your available merchant balance to your linked bank account. Payouts are processed within 1–2 business days.',
    content: (
      <div className="space-y-6">
        <h3 className="text-base font-bold text-gray-900">Endpoints</h3>
        <div className="space-y-2">
          <Endpoint method="GET"  path="/api/v1/merchant/payouts?page=0&size=20" />
          <Endpoint method="POST" path="/api/v1/merchant/payouts" />
        </div>

        <h3 className="text-base font-bold text-gray-900">Request a payout</h3>
        <Table
          headers={['Field', 'Type', 'Required', 'Description']}
          rows={[
            ['amount', 'decimal', 'Yes', 'GHS amount to withdraw. Must not exceed available balance.'],
            ['note',   'string',  'No',  'Optional internal memo for your records'],
          ]}
        />

        <h3 className="text-base font-bold text-gray-900">Payout statuses</h3>
        <Table
          headers={['Status', 'Description']}
          rows={[
            ['PENDING',   'Payout queued, awaiting processing'],
            ['PROCESSING', 'Transfer initiated to your bank'],
            ['COMPLETED', 'Funds received in your bank account'],
            ['FAILED',    'Payout failed; balance not debited'],
          ]}
        />

        <Note>
          Your bank account details are configured in the merchant dashboard under <strong>Settings → Bank Account</strong>. Payouts require a verified bank account.
        </Note>

        <h3 className="text-base font-bold text-gray-900">Check your available balance</h3>
        <Endpoint method="GET" path="/api/v1/merchant/reports/summary" />
        <p className="text-sm">The summary endpoint returns your current balance, total revenue, and session counts.</p>
      </div>
    ),
    codeSnippets: {
      curl: `# Check available balance
curl -X GET ${BASE}/api/v1/merchant/reports/summary \\
  -H "X-Api-Key: sk_live_YOUR_KEY"

# Request a payout
curl -X POST ${BASE}/api/v1/merchant/payouts \\
  -H "X-Api-Key: sk_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 2000.00,
    "note": "Weekly withdrawal"
  }'`,
      js: `const BASE    = '${BASE}';
const HEADERS = { 'X-Api-Key': 'sk_live_YOUR_KEY', 'Content-Type': 'application/json' };

// Check balance first
const { data: summary } = await fetch(
  \`\${BASE}/api/v1/merchant/reports/summary\`,
  { headers: HEADERS }
).then(r => r.json());

console.log('Available:', summary.availableBalance);

// Request payout
const { data: payout } = await fetch(\`\${BASE}/api/v1/merchant/payouts\`, {
  method: 'POST',
  headers: HEADERS,
  body: JSON.stringify({ amount: 2000.00, note: 'Weekly withdrawal' }),
}).then(r => r.json());

console.log(payout.id, payout.status);`,
      python: `import requests

BASE    = '${BASE}'
HEADERS = {'X-Api-Key': 'sk_live_YOUR_KEY', 'Content-Type': 'application/json'}

# Check balance
summary = requests.get(
    f'{BASE}/api/v1/merchant/reports/summary',
    headers=HEADERS
).json()['data']
print('Available:', summary['availableBalance'])

# Request payout
payout = requests.post(
    f'{BASE}/api/v1/merchant/payouts',
    headers=HEADERS,
    json={'amount': 2000.00, 'note': 'Weekly withdrawal'}
).json()['data']

print(payout['id'], payout['status'])`,
      java: `import java.net.URI;
import java.net.http.*;

var client = HttpClient.newHttpClient();
String BASE = "https://api.aza.systems";

// Check available balance
var summary = client.send(
    HttpRequest.newBuilder()
        .uri(URI.create(BASE + "/api/v1/merchant/reports/summary"))
        .header("X-Api-Key", "sk_live_YOUR_KEY")
        .GET().build(),
    HttpResponse.BodyHandlers.ofString());
System.out.println("Balance: " + summary.body());

// Request a payout
String body = "{\"amount\": 2000.00, \"note\": \"Weekly withdrawal\"}";
var payout = client.send(
    HttpRequest.newBuilder()
        .uri(URI.create(BASE + "/api/v1/merchant/payouts"))
        .header("X-Api-Key", "sk_live_YOUR_KEY")
        .header("Content-Type", "application/json")
        .POST(HttpRequest.BodyPublishers.ofString(body)).build(),
    HttpResponse.BodyHandlers.ofString());
System.out.println(payout.body());`,
    },
  },

  // ── Webhook Setup ────────────────────────────────────────────────────────────
  'webhooks-overview': {
    id: 'webhooks-overview',
    category: 'Webhooks',
    title: 'Webhook Setup',
    subtitle: 'Receive real-time payment event notifications',
    lastUpdated: 'May 2026',
    description: 'Webhooks deliver HTTP POST requests to your server when payment events occur. Configure endpoint URLs in your dashboard or via the API. Your server must respond with 200 within 10 seconds.',
    content: (
      <div className="space-y-6">
        <h3 className="text-base font-bold text-gray-900">Endpoints</h3>
        <div className="space-y-2">
          <Endpoint method="GET"    path="/api/v1/merchant/webhooks" />
          <Endpoint method="POST"   path="/api/v1/merchant/webhooks" />
          <Endpoint method="DELETE" path="/api/v1/merchant/webhooks/{id}" />
        </div>

        <h3 className="text-base font-bold text-gray-900">Register a webhook endpoint</h3>
        <Table
          headers={['Field', 'Type', 'Required', 'Description']}
          rows={[
            ['url',    'string',   'Yes', 'HTTPS URL that receives POST events'],
            ['events', 'string[]', 'No',  'Specific events to subscribe to. Omit to receive all.'],
          ]}
        />

        <h3 className="text-base font-bold text-gray-900">Supported events</h3>
        <Table
          headers={['Event', 'Fired when']}
          rows={[
            ['session.completed',  'A checkout session is paid successfully'],
            ['session.expired',    'A checkout session expires without payment'],
            ['session.refunded',   'A refund is issued against a session'],
            ['invoice.paid',       'A customer pays an invoice'],
            ['invoice.overdue',    'An invoice passes its due date unpaid'],
            ['payout.completed',   'A payout is successfully sent to your bank'],
            ['payout.failed',      'A payout processing attempt fails'],
            ['dispute.opened',     'A customer opens a dispute on a payment'],
          ]}
        />

        <h3 className="text-base font-bold text-gray-900">Event payload structure</h3>
        <pre className="p-3 bg-gray-50 border border-gray-200 rounded-lg font-mono text-[11px] text-gray-700 overflow-x-auto">{`{
  "id": "evt_20260527_abc123",
  "type": "session.completed",
  "createdAt": "2026-05-27T11:05:00Z",
  "data": {
    "id": "sess_7f3a9b",
    "amount": 50.00,
    "currency": "GHS",
    "status": "COMPLETED",
    "reference": "order_1042"
  }
}`}</pre>

        <Note>
          If your endpoint returns any status other than <code>2xx</code>, Aza will retry delivery up to <strong>5 times</strong> with exponential backoff (30 s, 2 min, 10 min, 1 hr, 6 hr).
        </Note>
      </div>
    ),
    codeSnippets: {
      curl: `# Register a webhook endpoint
curl -X POST ${BASE}/api/v1/merchant/webhooks \\
  -H "X-Api-Key: sk_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://yourserver.com/webhooks/aza",
    "events": ["session.completed", "payout.completed"]
  }'

# List webhooks
curl -X GET ${BASE}/api/v1/merchant/webhooks \\
  -H "X-Api-Key: sk_live_YOUR_KEY"`,
      js: `// Register webhook
const { data: wh } = await fetch('${BASE}/api/v1/merchant/webhooks', {
  method: 'POST',
  headers: {
    'X-Api-Key': 'sk_live_YOUR_KEY',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    url: 'https://yourserver.com/webhooks/aza',
    events: ['session.completed', 'payout.completed'],
  }),
}).then(r => r.json());

console.log('Webhook ID:', wh.id, '| Secret:', wh.secret);

// --- Express handler ---
import express from 'express';
const app = express();
app.post('/webhooks/aza', express.json(), (req, res) => {
  const event = req.body;
  if (event.type === 'session.completed') {
    console.log('Payment received:', event.data.id, event.data.amount);
  }
  res.sendStatus(200);
});`,
      python: `import requests
from flask import Flask, request, jsonify

BASE    = '${BASE}'
HEADERS = {'X-Api-Key': 'sk_live_YOUR_KEY', 'Content-Type': 'application/json'}

# Register webhook
wh = requests.post(
    f'{BASE}/api/v1/merchant/webhooks',
    headers=HEADERS,
    json={
        'url': 'https://yourserver.com/webhooks/aza',
        'events': ['session.completed', 'payout.completed'],
    }
).json()['data']

print('Webhook ID:', wh['id'], '| Secret:', wh['secret'])

# --- Flask handler ---
app = Flask(__name__)

@app.route('/webhooks/aza', methods=['POST'])
def handle_webhook():
    event = request.json
    if event['type'] == 'session.completed':
        print('Payment:', event['data']['id'], event['data']['amount'])
    return jsonify(received=True), 200`,
      java: `import java.net.URI;
import java.net.http.*;

var client = HttpClient.newHttpClient();

// Register webhook endpoint
String body = "{\"url\":\"https://yourserver.com/webhooks/aza\","
    + "\"events\":[\"session.completed\",\"payout.completed\"]}";
var res = client.send(
    HttpRequest.newBuilder()
        .uri(URI.create("https://api.aza.systems/api/v1/merchant/webhooks"))
        .header("X-Api-Key", "sk_live_YOUR_KEY")
        .header("Content-Type", "application/json")
        .POST(HttpRequest.BodyPublishers.ofString(body)).build(),
    HttpResponse.BodyHandlers.ofString());
System.out.println(res.body()); // contains webhook id and signing secret

// Spring Boot handler example:
// @RestController
// public class WebhookController {
//   @PostMapping("/webhooks/aza")
//   public ResponseEntity<Void> handle(@RequestBody String payload,
//       @RequestHeader("X-Aza-Signature") String sig) {
//     // verify signature, then process event
//     return ResponseEntity.ok().build();
//   }
// }`,
    },
  },

  // ── Signature Verification ───────────────────────────────────────────────────
  'webhooks-signatures': {
    id: 'webhooks-signatures',
    category: 'Webhooks',
    title: 'Signature Verification',
    subtitle: 'Authenticate that events come from Aza',
    lastUpdated: 'May 2026',
    description: 'Every webhook delivery includes an X-Aza-Signature header. Verify it using your webhook secret to confirm the payload was not tampered with.',
    content: (
      <div className="space-y-6">
        <h3 className="text-base font-bold text-gray-900">Header format</h3>
        <pre className="p-3 bg-gray-50 border border-gray-200 rounded-lg font-mono text-[11px] text-gray-700">
          X-Aza-Signature: t=1716800000,v1=a3f9d2...
        </pre>

        <h3 className="text-base font-bold text-gray-900">Verification steps</h3>
        <ol className="list-decimal pl-5 space-y-2 text-sm">
          <li>Split the header on <code>,</code> to get the <code>t</code> (timestamp) and <code>v1</code> (HMAC) parts.</li>
          <li>Build the signed string: <code>{`${'{timestamp}'}.${'{rawBody}'}`}</code></li>
          <li>Compute <strong>HMAC-SHA256</strong> of that string using your webhook secret.</li>
          <li>Compare the result (constant-time) to the <code>v1</code> value.</li>
          <li>Optionally reject events where <code>t</code> is older than 5 minutes to prevent replay attacks.</li>
        </ol>

        <Warn>
          Always verify signatures before processing webhook data in production. Skipping this step allows anyone to send fraudulent events to your endpoint.
        </Warn>
      </div>
    ),
    codeSnippets: {
      curl: `# Signatures must be verified in server code.
# Use the Node.js or Python snippet to implement verification.`,
      js: `import crypto from 'crypto';

function verifyAzaSignature(rawBody, signatureHeader, secret) {
  const parts     = signatureHeader.split(',');
  const timestamp = parts.find(p => p.startsWith('t='))?.split('=')[1];
  const v1        = parts.find(p => p.startsWith('v1='))?.split('=')[1];

  if (!timestamp || !v1) return false;

  // Reject events older than 5 minutes
  if (Date.now() / 1000 - parseInt(timestamp) > 300) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(\`\${timestamp}.\${rawBody}\`)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(v1),
    Buffer.from(expected)
  );
}

// Express usage
app.post('/webhooks/aza', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['x-aza-signature'];
  if (!verifyAzaSignature(req.body.toString(), sig, process.env.AZA_WEBHOOK_SECRET)) {
    return res.status(400).send('Invalid signature');
  }
  const event = JSON.parse(req.body);
  // process event...
  res.sendStatus(200);
});`,
      python: `import hmac
import hashlib
import time

def verify_aza_signature(raw_body: bytes, signature_header: str, secret: str) -> bool:
    parts     = dict(p.split('=', 1) for p in signature_header.split(','))
    timestamp = parts.get('t')
    v1        = parts.get('v1')

    if not timestamp or not v1:
        return False

    # Reject events older than 5 minutes
    if time.time() - int(timestamp) > 300:
        return False

    signed    = f"{timestamp}.".encode() + raw_body
    expected  = hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()
    return hmac.compare_digest(v1, expected)

# Flask usage
from flask import Flask, request, abort

app = Flask(__name__)

@app.route('/webhooks/aza', methods=['POST'])
def handle():
    sig = request.headers.get('X-Aza-Signature', '')
    if not verify_aza_signature(request.data, sig, 'your_webhook_secret'):
        abort(400)
    event = request.json
    # process event...
    return '', 200`,
      java: `import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;

public static boolean verifySignature(
        String rawBody, String sigHeader, String secret) throws Exception {
    String timestamp = null, v1 = null;
    for (String part : sigHeader.split(",")) {
        if (part.startsWith("t="))  timestamp = part.substring(2);
        if (part.startsWith("v1=")) v1         = part.substring(3);
    }
    if (timestamp == null || v1 == null) return false;

    // Reject events older than 5 minutes
    if (System.currentTimeMillis() / 1000 - Long.parseLong(timestamp) > 300)
        return false;

    String signed = timestamp + "." + rawBody;
    Mac mac = Mac.getInstance("HmacSHA256");
    mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
    String expected = HexFormat.of().formatHex(
        mac.doFinal(signed.getBytes(StandardCharsets.UTF_8)));

    return MessageDigest.isEqual(
        expected.getBytes(StandardCharsets.UTF_8),
        v1.getBytes(StandardCharsets.UTF_8));
}

// Spring Boot usage:
// @PostMapping("/webhooks/aza")
// public ResponseEntity<Void> handle(
//     @RequestBody byte[] body,
//     @RequestHeader("X-Aza-Signature") String sig) throws Exception {
//   if (!verifySignature(new String(body), sig, webhookSecret))
//     return ResponseEntity.status(400).build();
//   // process event...
//   return ResponseEntity.ok().build();
// }`,
    },
  },

  // ── Error Codes ──────────────────────────────────────────────────────────────
  errors: {
    id: 'errors',
    category: 'Reference',
    title: 'Error Codes',
    subtitle: 'Understand and handle API errors',
    lastUpdated: 'May 2026',
    description: 'The Aza API uses standard HTTP status codes. On error, the response body always includes a machine-readable error field alongside a human-readable message.',
    content: (
      <div className="space-y-6">
        <h3 className="text-base font-bold text-gray-900">Error response shape</h3>
        <pre className="p-3 bg-gray-50 border border-gray-200 rounded-lg font-mono text-[11px] text-gray-700 overflow-x-auto">{`{
  "success": false,
  "error": "INSUFFICIENT_BALANCE",
  "message": "Your available balance is GH₵120.00, but GH₵500.00 was requested.",
  "statusCode": 400
}`}</pre>

        <h3 className="text-base font-bold text-gray-900">HTTP status codes</h3>
        <Table
          headers={['Code', 'Meaning']}
          rows={[
            ['200', 'OK — request succeeded'],
            ['201', 'Created — resource successfully created'],
            ['400', 'Bad Request — invalid parameters or validation error'],
            ['401', 'Unauthorized — missing or invalid API key'],
            ['403', 'Forbidden — account not active or feature not permitted'],
            ['404', 'Not Found — resource does not exist'],
            ['409', 'Conflict — duplicate resource (e.g. code already exists)'],
            ['422', 'Unprocessable Entity — business logic error'],
            ['429', 'Too Many Requests — rate limit exceeded'],
            ['500', 'Internal Server Error — contact support if persistent'],
          ]}
        />

        <h3 className="text-base font-bold text-gray-900">Common error codes</h3>
        <Table
          headers={['error field', 'Description']}
          rows={[
            ['INVALID_API_KEY',        'The X-Api-Key header is missing or malformed'],
            ['MERCHANT_NOT_ACTIVE',    'Merchant account is pending KYB or suspended'],
            ['INSUFFICIENT_BALANCE',   'Requested payout exceeds available balance'],
            ['SESSION_ALREADY_PAID',   'Attempting to refund a non-completed session'],
            ['DUPLICATE_CODE',         'Discount code with this value already exists'],
            ['INVOICE_NOT_DRAFT',      'Trying to send an invoice not in DRAFT status'],
            ['WEBHOOK_URL_UNREACHABLE','URL failed connectivity check during registration'],
          ]}
        />
      </div>
    ),
    codeSnippets: {
      curl: `# A 401 response (invalid key)
# HTTP/1.1 401 Unauthorized
# {
#   "success": false,
#   "error": "INVALID_API_KEY",
#   "message": "The provided API key is invalid or has been revoked.",
#   "statusCode": 401
# }

# Test your key
curl -X GET ${BASE}/api/v1/merchant/profile \\
  -H "X-Api-Key: sk_live_YOUR_KEY"`,
      js: `async function azaRequest(path, options = {}) {
  const res = await fetch(\`${BASE}\${path}\`, {
    ...options,
    headers: {
      'X-Api-Key': process.env.AZA_API_KEY,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const body = await res.json();
  if (!body.success) {
    const err = new Error(body.message);
    err.code = body.error;
    err.status = res.status;
    throw err;
  }
  return body.data;
}

// Usage
try {
  const profile = await azaRequest('/api/v1/merchant/profile');
} catch (err) {
  if (err.code === 'MERCHANT_NOT_ACTIVE') {
    console.error('Complete KYB before using the API');
  } else {
    console.error(err.code, err.message);
  }
}`,
      python: `import requests

class AzaError(Exception):
    def __init__(self, code, message, status):
        super().__init__(message)
        self.code   = code
        self.status = status

def aza_request(method, path, **kwargs):
    resp = requests.request(
        method,
        f'${BASE}{path}',
        headers={'X-Api-Key': 'sk_live_YOUR_KEY', **kwargs.pop('headers', {})},
        **kwargs
    )
    body = resp.json()
    if not body.get('success'):
        raise AzaError(body['error'], body['message'], resp.status_code)
    return body['data']

try:
    profile = aza_request('GET', '/api/v1/merchant/profile')
except AzaError as e:
    if e.code == 'MERCHANT_NOT_ACTIVE':
        print('Complete KYB first')
    else:
        print(e.code, str(e))`,
      java: `import java.net.URI;
import java.net.http.*;

public static String azaRequest(HttpClient client, String apiKey,
        String method, String path, String body) throws Exception {
    var builder = HttpRequest.newBuilder()
        .uri(URI.create("https://api.aza.systems" + path))
        .header("X-Api-Key", apiKey)
        .header("Content-Type", "application/json");
    var req = body != null
        ? builder.method(method, HttpRequest.BodyPublishers.ofString(body)).build()
        : builder.method(method, HttpRequest.BodyPublishers.noBody()).build();
    var res = client.send(req, HttpResponse.BodyHandlers.ofString());
    if (res.statusCode() >= 400)
        throw new RuntimeException("AZA:" + res.statusCode() + " " + res.body());
    return res.body();
}

// Usage
var client = HttpClient.newHttpClient();
try {
    String profile = azaRequest(client, "sk_live_YOUR_KEY",
        "GET", "/api/v1/merchant/profile", null);
    System.out.println(profile);
} catch (RuntimeException e) {
    if (e.getMessage().contains("MERCHANT_NOT_ACTIVE"))
        System.err.println("Complete KYB before using the API");
    else
        System.err.println(e.getMessage());
}`,
    },
  },

  // ── Response Format ──────────────────────────────────────────────────────────
  'response-format': {
    id: 'response-format',
    category: 'Reference',
    title: 'Response Format',
    subtitle: 'Consistent JSON envelope across all endpoints',
    lastUpdated: 'May 2026',
    description: 'Every response from the Aza API is a JSON object with a predictable envelope. Successful responses have success: true and a data field; errors have success: false and an error field.',
    content: (
      <div className="space-y-6">
        <h3 className="text-base font-bold text-gray-900">Success envelope</h3>
        <pre className="p-3 bg-gray-50 border border-gray-200 rounded-lg font-mono text-[11px] text-gray-700 overflow-x-auto">{`{
  "success": true,
  "data": { ... }           // single object
}

// OR paginated list:
{
  "success": true,
  "data": {
    "content": [ ... ],     // array of items
    "page": 0,              // zero-indexed current page
    "size": 20,             // items per page
    "totalElements": 142,   // total records across all pages
    "totalPages": 8
  }
}`}</pre>

        <h3 className="text-base font-bold text-gray-900">Error envelope</h3>
        <pre className="p-3 bg-gray-50 border border-gray-200 rounded-lg font-mono text-[11px] text-gray-700 overflow-x-auto">{`{
  "success": false,
  "error": "INSUFFICIENT_BALANCE",
  "message": "Human-readable description",
  "statusCode": 400
}`}</pre>

        <h3 className="text-base font-bold text-gray-900">Date & time format</h3>
        <p className="text-sm">All timestamps are <strong>ISO 8601</strong> strings in UTC, e.g. <code>2026-05-27T11:00:00Z</code>.</p>

        <h3 className="text-base font-bold text-gray-900">Amount format</h3>
        <p className="text-sm">Amounts are <strong>decimal numbers</strong> (not integers or strings), e.g. <code>50.00</code>. The currency field indicates the unit (default: <code>GHS</code>).</p>

        <h3 className="text-base font-bold text-gray-900">Pagination</h3>
        <Table
          headers={['Query parameter', 'Default', 'Description']}
          rows={[
            ['page', '0', 'Zero-indexed page number'],
            ['size', '20', 'Items per page (max 100)'],
          ]}
        />
      </div>
    ),
    codeSnippets: {
      curl: `# All list endpoints support ?page= and ?size=
curl -X GET "${BASE}/api/v1/merchant/sessions?page=0&size=50" \\
  -H "X-Api-Key: sk_live_YOUR_KEY"

# Response:
# {
#   "success": true,
#   "data": {
#     "content": [...],
#     "page": 0,
#     "size": 50,
#     "totalElements": 312,
#     "totalPages": 7
#   }
# }`,
      js: `// Generic paginator helper
async function* paginate(path, headers) {
  let page = 0;
  while (true) {
    const res = await fetch(
      \`${BASE}\${path}?page=\${page}&size=100\`,
      { headers }
    ).then(r => r.json());

    const { content, totalPages } = res.data;
    yield* content;

    if (++page >= totalPages) break;
  }
}

// Usage: iterate all sessions
const HEADERS = { 'X-Api-Key': 'sk_live_YOUR_KEY' };
for await (const session of paginate('/api/v1/merchant/sessions', HEADERS)) {
  console.log(session.id, session.status);
}`,
      python: `import requests

def paginate(path, headers, size=100):
    page = 0
    while True:
        resp = requests.get(
            f'${BASE}{path}',
            params={'page': page, 'size': size},
            headers=headers
        ).json()['data']
        yield from resp['content']
        page += 1
        if page >= resp['totalPages']:
            break

HEADERS = {'X-Api-Key': 'sk_live_YOUR_KEY'}
for session in paginate('/api/v1/merchant/sessions', HEADERS):
    print(session['id'], session['status'])`,
      java: `import java.net.URI;
import java.net.http.*;

// Paginate through all sessions
var client = HttpClient.newHttpClient();
int page = 0, totalPages = Integer.MAX_VALUE;

while (page < totalPages) {
    var res = client.send(
        HttpRequest.newBuilder()
            .uri(URI.create(
                "https://api.aza.systems/api/v1/merchant/sessions"
                + "?page=" + page + "&size=100"))
            .header("X-Api-Key", "sk_live_YOUR_KEY")
            .GET().build(),
        HttpResponse.BodyHandlers.ofString());
    System.out.println("Page " + page + ": " + res.body());
    // Parse totalPages with your JSON library, e.g. Jackson:
    // totalPages = mapper.readTree(res.body())
    //     .path("data").path("totalPages").asInt();
    break; // remove once totalPages parsing is wired up
    page++;
}`,
    },
  },

  // ── SDKs & Libraries ─────────────────────────────────────────────────────────
  sdks: {
    id: 'sdks',
    category: 'Getting Started',
    title: 'SDKs & Libraries',
    subtitle: 'Integrate Aza using your preferred language',
    lastUpdated: 'May 2026',
    description: 'Aza does not currently publish official language SDKs. The API is a standard REST interface — any HTTP client works. This guide shows the recommended setup for the most common environments.',
    content: (
      <div className="space-y-6">
        <Note>
          Official SDKs for Node.js and Python are on the roadmap. Until then, the raw HTTP approach below is the recommended integration path — it requires no extra dependencies.
        </Note>

        <h3 className="text-base font-bold text-gray-900">Node.js / TypeScript</h3>
        <p className="text-sm">Use the native <code>fetch</code> API (Node 18+) or <code>axios</code>. A thin wrapper is enough:</p>
        <pre className="p-3 bg-gray-50 border border-gray-200 rounded-lg font-mono text-[11px] text-gray-700 overflow-x-auto">{`// aza.ts
const BASE = 'https://api.aza.systems';

export async function azaFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(BASE + path, {
    ...options,
    headers: {
      'X-Api-Key': process.env.AZA_API_KEY!,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const body = await res.json();
  if (!body.success) throw Object.assign(new Error(body.message), { code: body.error });
  return body.data;
}`}</pre>

        <h3 className="text-base font-bold text-gray-900">Python</h3>
        <p className="text-sm">Use the <code>requests</code> library. Create a <code>Session</code> so headers are set once:</p>
        <pre className="p-3 bg-gray-50 border border-gray-200 rounded-lg font-mono text-[11px] text-gray-700 overflow-x-auto">{`# aza.py
import os
import requests

class AzaClient:
    BASE = 'https://api.aza.systems'

    def __init__(self, api_key: str | None = None):
        self.session = requests.Session()
        self.session.headers.update({
            'X-Api-Key': api_key or os.environ['AZA_API_KEY'],
            'Content-Type': 'application/json',
        })

    def get(self, path: str, **params):
        r = self.session.get(self.BASE + path, params=params)
        body = r.json()
        if not body.get('success'):
            raise RuntimeError(f"{body['error']}: {body['message']}")
        return body['data']

    def post(self, path: str, payload: dict | None = None):
        r = self.session.post(self.BASE + path, json=payload or {})
        body = r.json()
        if not body.get('success'):
            raise RuntimeError(f"{body['error']}: {body['message']}")
        return body['data']`}</pre>

        <h3 className="text-base font-bold text-gray-900">PHP</h3>
        <pre className="p-3 bg-gray-50 border border-gray-200 rounded-lg font-mono text-[11px] text-gray-700 overflow-x-auto">{`// Use Guzzle: composer require guzzlehttp/guzzle
use GuzzleHttp\\Client;

$client = new Client([
    'base_uri' => 'https://api.aza.systems',
    'headers'  => [
        'X-Api-Key'    => getenv('AZA_API_KEY'),
        'Content-Type' => 'application/json',
    ],
]);

$res  = $client->post('/api/v1/merchant/sessions', ['json' => ['amount' => 50.00]]);
$body = json_decode($res->getBody(), true);
echo $body['data']['checkoutUrl'];`}</pre>

        <h3 className="text-base font-bold text-gray-900">Environment variables</h3>
        <Table
          headers={['Variable', 'Value']}
          rows={[
            ['AZA_API_KEY',        'Your sk_live_... or sk_test_... key'],
            ['AZA_WEBHOOK_SECRET', 'Your webhook endpoint signing secret'],
          ]}
        />
        <p className="text-sm">Never hard-code keys. Use <code>.env</code> files locally and your hosting provider&apos;s secret management in production.</p>
      </div>
    ),
    codeSnippets: {
      curl: `# No SDK needed — standard curl works everywhere

# Set your key as an env var (recommended)
export AZA_API_KEY="sk_live_YOUR_KEY"

# Then use it in any request
curl -X GET https://api.aza.systems/api/v1/merchant/profile \\
  -H "X-Api-Key: $AZA_API_KEY"

curl -X POST https://api.aza.systems/api/v1/merchant/sessions \\
  -H "X-Api-Key: $AZA_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"amount": 50.00, "description": "Test payment"}'`,
      js: `// Minimal wrapper — no npm packages needed (Node 18+)
// aza.ts
const BASE = 'https://api.aza.systems';

export async function azaFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(BASE + path, {
    ...options,
    headers: {
      'X-Api-Key': process.env.AZA_API_KEY!,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const body = await res.json();
  if (!body.success) throw Object.assign(new Error(body.message), { code: body.error });
  return body.data;
}

// Usage
const session = await azaFetch<{ id: string; checkoutUrl: string }>(
  '/api/v1/merchant/sessions',
  { method: 'POST', body: JSON.stringify({ amount: 50.00 }) }
);
console.log(session.checkoutUrl);`,
      python: `# pip install requests  (only dependency)
import os
import requests

class AzaClient:
    BASE = 'https://api.aza.systems'

    def __init__(self, api_key=None):
        self.session = requests.Session()
        self.session.headers.update({
            'X-Api-Key': api_key or os.environ['AZA_API_KEY'],
            'Content-Type': 'application/json',
        })

    def get(self, path, **params):
        r = self.session.get(self.BASE + path, params=params)
        body = r.json()
        if not body.get('success'):
            raise RuntimeError(f"{body['error']}: {body['message']}")
        return body['data']

    def post(self, path, payload=None):
        r = self.session.post(self.BASE + path, json=payload or {})
        body = r.json()
        if not body.get('success'):
            raise RuntimeError(f"{body['error']}: {body['message']}")
        return body['data']

# Usage
client = AzaClient()
session = client.post('/api/v1/merchant/sessions', {'amount': 50.00})
print(session['checkoutUrl'])`,
      java: `import java.net.URI;
import java.net.http.*;

// No SDK needed — Java 11+ HttpClient is sufficient
public class AzaClient {
    private static final String BASE = "https://api.aza.systems";
    private final HttpClient http = HttpClient.newHttpClient();
    private final String apiKey;

    public AzaClient(String apiKey) { this.apiKey = apiKey; }

    public String get(String path) throws Exception {
        var res = http.send(
            HttpRequest.newBuilder()
                .uri(URI.create(BASE + path))
                .header("X-Api-Key", apiKey)
                .GET().build(),
            HttpResponse.BodyHandlers.ofString());
        return checkSuccess(res);
    }

    public String post(String path, String json) throws Exception {
        var res = http.send(
            HttpRequest.newBuilder()
                .uri(URI.create(BASE + path))
                .header("X-Api-Key", apiKey)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json)).build(),
            HttpResponse.BodyHandlers.ofString());
        return checkSuccess(res);
    }

    private String checkSuccess(HttpResponse<String> res) {
        if (res.statusCode() >= 400) throw new RuntimeException(res.body());
        return res.body();
    }
}

// Usage
var aza = new AzaClient(System.getenv("AZA_API_KEY"));
String session = aza.post("/api/v1/merchant/sessions",
    "{\"amount\": 50.00, \"description\": \"Test payment\"}");
System.out.println(session); // contains checkoutUrl`,
    },
  },

  // ── Changelog ────────────────────────────────────────────────────────────────
  changelog: {
    id: 'changelog',
    category: 'Reference',
    title: 'Changelog',
    subtitle: 'API version history and breaking changes',
    lastUpdated: 'May 2026',
    description: 'All notable changes to the Aza Merchant API are documented here. The API follows semantic versioning. Breaking changes increment the major version; additive changes are released within the same version.',
    content: (
      <div className="space-y-8">
        <Note>
          The current stable version is <strong>v1</strong>. All endpoints are under <code>/api/v1/</code>. When v2 is introduced, v1 will be supported with a 6-month deprecation window.
        </Note>

        {[
          {
            version: 'v1.5.0',
            date: 'May 2026',
            tag: 'Latest',
            tagColor: '#22c55e',
            changes: [
              { type: 'New', text: 'Merchant invoices API — create, send, and cancel invoices with customer email delivery' },
              { type: 'New', text: 'Discount codes API — percentage and fixed-amount codes with optional usage caps and expiry' },
              { type: 'New', text: 'Settlements endpoint — paginated settlement summaries with gross/fee/net breakdown' },
              { type: 'New', text: 'Disputes endpoint — view open and resolved disputes against your merchant account' },
              { type: 'New', text: 'Refund endpoint — POST /sessions/{id}/refund to issue a full refund on any COMPLETED session' },
              { type: 'New', text: 'Audit logs endpoint — paginated activity log for your merchant account' },
              { type: 'New', text: 'Customers endpoint — paginated list of all customers with spend and payment count' },
              { type: 'Improved', text: 'Webhook delivery now retries 5 times with exponential backoff (30s → 6h)' },
              { type: 'Improved', text: 'Merchant profile endpoint now returns brandColor and checkoutTagline fields' },
            ],
          },
          {
            version: 'v1.4.0',
            date: 'Apr 2026',
            tag: null,
            tagColor: '',
            changes: [
              { type: 'New', text: 'Automated payouts — configure schedules and trigger on-demand withdrawals' },
              { type: 'New', text: 'Bulk transfers — POST /merchant/bulk-transfers accepts up to 100 recipients' },
              { type: 'New', text: 'Notification preferences endpoint — manage push and email alert settings' },
              { type: 'Improved', text: 'Session creation now accepts a reference field for idempotency' },
              { type: 'Fixed', text: 'Webhook signature header now consistently uses X-Aza-Signature format' },
            ],
          },
          {
            version: 'v1.3.0',
            date: 'Mar 2026',
            tag: null,
            tagColor: '',
            changes: [
              { type: 'New', text: 'Merchant API keys management — create, list, and revoke keys from the API' },
              { type: 'New', text: 'Webhook endpoints management — register and delete webhook URLs via the API' },
              { type: 'New', text: 'Static payment page at aza.systems/pay/{handle} — live when merchant is ACTIVE' },
              { type: 'New', text: 'Public merchant profile endpoint — GET /merchant/public/{handle} (no auth)' },
              { type: 'Improved', text: 'Payout requests now validate against available balance before queuing' },
            ],
          },
          {
            version: 'v1.2.0',
            date: 'Feb 2026',
            tag: null,
            tagColor: '',
            changes: [
              { type: 'New', text: 'Merchant portal at merchants.aza.systems — KYB onboarding, dashboard, transactions' },
              { type: 'New', text: 'Checkout sessions API — create hosted payment sessions with deep links' },
              { type: 'New', text: 'Payment link generation — QR codes pointing to pay.aza.systems/c/{sessionId}' },
              { type: 'Breaking', text: 'X-Api-Key header replaces Authorization: Bearer for all /merchant/* routes' },
            ],
          },
          {
            version: 'v1.0.0',
            date: 'Jan 2026',
            tag: 'Initial',
            tagColor: '#6366f1',
            changes: [
              { type: 'New', text: 'Initial public release of the Aza Merchant API' },
              { type: 'New', text: 'User authentication, wallet management, and peer transfers' },
              { type: 'New', text: 'KYC verification flow' },
              { type: 'New', text: 'Merchant registration and KYB onboarding' },
            ],
          },
        ].map((release) => (
          <div key={release.version} className="relative pl-6 border-l-2 border-gray-200">
            <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-white border-2 border-gray-300" />
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-extrabold text-gray-900">{release.version}</span>
              <span className="text-xs text-gray-400">{release.date}</span>
              {release.tag && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: release.tagColor + '20', color: release.tagColor }}>
                  {release.tag}
                </span>
              )}
            </div>
            <ul className="space-y-2">
              {release.changes.map((c, i) => {
                const color = c.type === 'New' ? '#22c55e' : c.type === 'Breaking' ? '#ef4444' : c.type === 'Fixed' ? '#3b82f6' : '#f59e0b';
                return (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5" style={{ background: color + '15', color }}>
                      {c.type}
                    </span>
                    {c.text}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    ),
    codeSnippets: {
      curl: `# Check the current API version in any response header
curl -I https://api.aza.systems/api/v1/merchant/profile \\
  -H "X-Api-Key: sk_live_YOUR_KEY"

# The response includes:
# X-Api-Version: 1.5.0
# X-Deprecation-Notice: (set if endpoint is deprecated)`,
      js: `// Verify API version compatibility at startup
const res = await fetch('https://api.aza.systems/api/v1/merchant/profile', {
  method: 'HEAD',
  headers: { 'X-Api-Key': process.env.AZA_API_KEY! },
});

const version = res.headers.get('X-Api-Version');
console.log('API version:', version);

// Recommended: pin a minimum version in your integration
const [major] = (version ?? '1.0').split('.').map(Number);
if (major < 1) throw new Error('Unsupported API version');`,
      python: `import requests

# Check API version via HEAD request
res = requests.head(
    'https://api.aza.systems/api/v1/merchant/profile',
    headers={'X-Api-Key': 'sk_live_YOUR_KEY'}
)

version = res.headers.get('X-Api-Version', '1.0')
print('API version:', version)

major = int(version.split('.')[0])
if major < 1:
    raise RuntimeError('Unsupported API version')`,
      java: `import java.net.URI;
import java.net.http.*;

// Check API version via HEAD request
var client = HttpClient.newHttpClient();
var res = client.send(
    HttpRequest.newBuilder()
        .uri(URI.create("https://api.aza.systems/api/v1/merchant/profile"))
        .header("X-Api-Key", "sk_live_YOUR_KEY")
        .method("HEAD", HttpRequest.BodyPublishers.noBody()).build(),
    HttpResponse.BodyHandlers.discarding());

String version = res.headers().firstValue("X-Api-Version").orElse("1.0");
System.out.println("API version: " + version);

int major = Integer.parseInt(version.split("\\.")[0]);
if (major < 1) throw new RuntimeException("Unsupported API version: " + version);`,
    },
  },
};
