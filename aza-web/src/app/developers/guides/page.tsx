'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ChevronRight,
  Copy,
  Check,
  ExternalLink,
  BookOpen,
  ArrowRight,
  AlertTriangle,
  Info,
  Menu,
  X,
  Code
} from 'lucide-react';

// Define the supported code tabs
type CodeTab = 'curl' | 'js' | 'python';

// Define structure for doc articles
interface DocArticle {
  id: string;
  title: string;
  category: string;
  subtitle: string;
  lastUpdated: string;
  description: string;
  content: React.ReactNode;
  codeSnippets: {
    curl: string;
    js: string;
    python: string;
  };
}

export default function GuidesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#ffffff] font-sans antialiased text-[#1f2937]">
        <div className="text-center">
          <p className="text-sm font-medium text-gray-500 font-mono">Loading documentation...</p>
        </div>
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

  // Sync active doc state with query parameter
  useEffect(() => {
    const docParam = searchParams.get('doc');
    if (docParam && docMap[docParam]) {
      setActiveDoc(docParam);
    }
  }, [searchParams]);

  // Set the doc parameter in the URL without triggering full page reload
  const handleSelectDoc = (docId: string) => {
    setActiveDoc(docId);
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
    <div className="min-h-screen flex flex-col md:flex-row bg-[#ffffff] font-sans antialiased text-[#1f2937]">
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-[#0e2a0e] text-white border-b border-white/10 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black bg-[#B7EE7A] text-[#174717]">
            A
          </span>
          <span className="font-extrabold text-sm tracking-tight">aza developers</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1 text-white/80 hover:text-white"
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside
        className={`w-full md:w-64 flex-shrink-0 flex flex-col bg-[#0e2a0e] text-white border-r border-[#174717] md:sticky md:top-0 md:h-screen overflow-y-auto z-40 transition-all duration-200 ${
          mobileMenuOpen ? 'fixed inset-x-0 bottom-0 top-[53px]' : 'hidden md:flex'
        }`}
      >
        {/* Branding header (desktop only) */}
        <div className="hidden md:block p-5 border-b border-white/5">
          <Link href="/" className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black bg-[#B7EE7A] text-[#174717]">
              A
            </span>
            <div>
              <p className="font-extrabold text-sm leading-none tracking-tight">aza</p>
              <p className="text-[10px] font-bold tracking-wider text-[#B7EE7A]/60 mt-1 uppercase">
                Developer Guides
              </p>
            </div>
          </Link>
        </div>

        {/* Sidebar Navigation List */}
        <nav className="flex-1 p-4 flex flex-col gap-5">
          {navigationGroups.map((group) => (
            <div key={group.title} className="flex flex-col gap-1">
              <h2 className="text-[10px] font-extrabold uppercase tracking-wider text-[#B7EE7A]/40 px-2 py-1">
                {group.title}
              </h2>
              {group.items.map((item) => {
                const isActive = activeDoc === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectDoc(item.id)}
                    className={`w-full text-left px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center justify-between ${
                      isActive
                        ? 'bg-white/10 text-white font-semibold'
                        : 'text-white/60 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {item.label}
                    {isActive && <ChevronRight size={12} className="text-[#B7EE7A]" />}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Sidebar Footer Link */}
        <div className="p-4 border-t border-white/5 bg-[#0a1f0a] flex flex-col gap-2">
          <Link
            href="/developers/api-explorer"
            className="flex items-center justify-between text-xs font-medium text-[#B7EE7A] hover:underline"
          >
            <span>API Reference Explorer</span>
            <ExternalLink size={12} />
          </Link>
          <div className="text-[10px] text-white/30 font-mono mt-1">
            API Version: v1
          </div>
        </div>
      </aside>

      {/* Main Panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <header className="sticky top-0 bg-[#ffffff] border-b border-gray-200 z-30 h-14 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-500 font-mono hidden md:inline">
              docs / guides / {currentDoc.category.toLowerCase().replace(' ', '-')}
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold">
            <button
              onClick={() => handleSelectDoc('intro')}
              className="px-3 py-1.5 border-b-2 border-[#174717] text-[#174717]"
            >
              Guides
            </button>
            <Link
              href="/developers/api-explorer"
              className="px-3 py-1.5 text-gray-500 hover:text-gray-900 border-b-2 border-transparent transition-colors"
            >
              API Reference
            </Link>
            <Link
              href="/developers/login"
              className="ml-2 px-3 py-1.5 bg-[#174717] text-white hover:bg-[#205c20] rounded-md transition-colors"
            >
              Dashboard
            </Link>
          </div>
        </header>

        {/* Content Body: Two-Column Docs layout */}
        <div className="flex-1 flex flex-col xl:flex-row overflow-y-auto">
          
          {/* Column 1: Document Details */}
          <main className="flex-1 px-6 py-8 max-w-3xl">
            <div className="border-b border-gray-150 pb-6 mb-6">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#2e7d2e] bg-[#2e7d2e]/10 px-2.5 py-1 rounded">
                {currentDoc.category}
              </span>
              <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mt-3">
                {currentDoc.title}
              </h1>
              <p className="text-sm text-gray-500 mt-2 font-medium">
                {currentDoc.subtitle} &middot; Last updated {currentDoc.lastUpdated}
              </p>
            </div>

            <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed space-y-6">
              <p className="text-base text-gray-600 font-normal">
                {currentDoc.description}
              </p>

              {currentDoc.content}
            </div>
          </main>

          {/* Column 2: Code Snippets Viewer Panel */}
          <aside className="w-full xl:w-[420px] bg-[#111827] text-[#e5e7eb] flex-shrink-0 flex flex-col border-t xl:border-t-0 xl:border-l border-gray-800 xl:sticky xl:top-14 xl:h-[calc(100vh-56px)] overflow-y-auto font-mono">
            {/* Header Tabs */}
            <div className="flex items-center justify-between px-4 py-2 bg-[#1f2937] border-b border-gray-800">
              <div className="flex items-center gap-1">
                {(['curl', 'js', 'python'] as CodeTab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveCodeTab(tab)}
                    className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                      activeCodeTab === tab
                        ? 'bg-[#111827] text-white border border-gray-700'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {tab === 'curl' ? 'cURL' : tab === 'js' ? 'Node.js' : 'Python'}
                  </button>
                ))}
              </div>
              <button
                onClick={() => copyCode(currentDoc.codeSnippets[activeCodeTab])}
                className="flex items-center gap-1 px-2.5 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 transition-colors border border-transparent hover:border-gray-700"
                title="Copy code to clipboard"
              >
                {copied ? (
                  <>
                    <Check size={12} className="text-[#B7EE7A]" />
                    <span className="text-[#B7EE7A]">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={12} />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            {/* Code Body */}
            <div className="flex-1 p-5 overflow-auto text-xs leading-relaxed bg-[#0b0f19]">
              <pre className="whitespace-pre-wrap break-all font-mono text-[#f3f4f6]">
                <code>{currentDoc.codeSnippets[activeCodeTab]}</code>
              </pre>
            </div>

            {/* Quick Sandbox Warning */}
            <div className="p-4 bg-[#1f2937] border-t border-gray-800 text-[10px] text-gray-400 leading-normal flex items-start gap-2">
              <Code size={13} className="text-[#B7EE7A] flex-shrink-0 mt-0.5" />
              <span>
                To execute requests, use the API sandbox URLs. Authenticate using your test token (`sk_test_...`) generated in the developer dashboard.
              </span>
            </div>
          </aside>

        </div>
      </div>
    </div>
  );
}

// ==================== SIDEBAR GROUPS ====================

const navigationGroups = [
  {
    title: 'Getting Started',
    items: [
      { id: 'intro', label: 'Introduction' },
      { id: 'sandbox', label: 'Sandbox & Testing' },
      { id: 'auth', label: 'Authentication' },
    ],
  },
  {
    title: 'Payments (Pay-in)',
    items: [
      { id: 'checkout', label: 'Checkout Sessions' },
      { id: 'requests', label: 'Payment Requests' },
    ],
  },
  {
    title: 'Payouts (Pay-out)',
    items: [
      { id: 'transfers', label: 'Direct Payouts' },
    ],
  },
  {
    title: 'Webhooks',
    items: [
      { id: 'webhooks-overview', label: 'Webhook Overview' },
      { id: 'webhooks-signatures', label: 'Signature Verification' },
    ],
  },
];

// ==================== DOCUMENT DETAILS & CONTENT ====================

const docMap: Record<string, DocArticle> = {
  intro: {
    id: 'intro',
    category: 'Getting Started',
    title: 'Introduction to Aza Developers',
    subtitle: 'Learn about Aza\'s architecture and integrations',
    lastUpdated: 'May 2026',
    description: 'Welcome to the Aza Developer documentation. Aza allows you to programmatically accept payments, send money, configure webhook listeners, and automate financial workflows within your app.',
    content: (
      <div className="space-y-6">
        <h3 className="text-base font-bold text-gray-900">Capabilities Overview</h3>
        <p>
          Aza provides robust, high-performance APIs optimized for mobile and web integration. The core flows supported by the Aza platform include:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong>Payments & Checkouts:</strong> Accept funds from users securely. We host the checkout interface so you do not have to manage compliance and card handling.</li>
          <li><strong>Direct Payouts:</strong> Pay out instantly to other wallets or connected bank routes.</li>
          <li><strong>Real-time Synchronization:</strong> Use Webhooks and WebSockets to update client applications when events occur.</li>
        </ul>

        <div className="flex items-start gap-3 p-4 bg-[#f0f9ff] border border-[#bae6fd] rounded-lg text-sm text-[#0369a1]">
          <Info size={18} className="flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Quick Tip:</span> To test integrations without making live transactions, sign up in the sandbox dashboard to obtain your test key bundle.
          </div>
        </div>
      </div>
    ),
    codeSnippets: {
      curl: `# Fetch API status and confirm reachability
curl -X GET https://api.aza.systems/v1/status`,
      js: `// Verify connection using the JS SDK
import { AzaClient } from '@aza/sdk';

const client = new AzaClient();
const status = await client.getStatus();
console.log(\`Connection: \${status.connected ? 'Active' : 'Offline'}\`);`,
      python: `# Verify connection using python
import aza

client = aza.Client()
status = client.get_status()
print(f"Connection: {'Active' if status.connected else 'Offline'}")`,
    },
  },
  sandbox: {
    id: 'sandbox',
    category: 'Getting Started',
    title: 'Sandbox & Environments',
    subtitle: 'Test your integration end-to-end safely',
    lastUpdated: 'May 2026',
    description: 'Aza provides an isolated sandbox environment mirroring the live environment. Test payouts, checkouts, error handling, and webhook delivery before launching in production.',
    content: (
      <div className="space-y-6">
        <h3 className="text-base font-bold text-gray-900">Environment Hostnames</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs text-left border-collapse border border-gray-200">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="p-2.5 font-bold text-gray-800">Environment</th>
                <th className="p-2.5 font-bold text-gray-800">Endpoint URL</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-150">
                <td className="p-2.5 font-semibold text-gray-700">Sandbox (Test)</td>
                <td className="p-2.5 font-mono text-gray-600">https://api.sandbox.aza.systems/v1</td>
              </tr>
              <tr>
                <td className="p-2.5 font-semibold text-gray-700">Production (Live)</td>
                <td className="p-2.5 font-mono text-gray-600">https://api.aza.systems/v1</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 className="text-base font-bold text-gray-900">Simulating Events</h3>
        <p>
          In the sandbox, you can simulate customer actions (like paying an invoice, inputting a bad PIN, or denying a request) programmatically by passing header toggles. See specific guide items below for testing headers.
        </p>
      </div>
    ),
    codeSnippets: {
      curl: `# Call sandbox with a test API key
curl -X GET https://api.sandbox.aza.systems/v1/wallet/balance \\
  -H "Authorization: Bearer sk_test_51Nx8X2"` ,
      js: `// Instantiate client pointing to sandbox
import { AzaClient } from '@aza/sdk';

const client = new AzaClient({
  apiKey: 'sk_test_51Nx8X2',
  environment: 'sandbox'
});

const balance = await client.wallet.getBalance();`,
      python: `# Instantiate client pointing to sandbox
import aza

client = aza.Client(
    api_key="sk_test_51Nx8X2",
    environment="sandbox"
)
balance = client.wallet.get_balance()`,
    },
  },
  auth: {
    id: 'auth',
    category: 'Getting Started',
    title: 'Authentication',
    subtitle: 'Secure requests to the Aza platform',
    lastUpdated: 'May 2026',
    description: 'The Aza API enforces Bearer Token authentication. All requests must include your secure API keys inside the Authorization header.',
    content: (
      <div className="space-y-6">
        <h3 className="text-base font-bold text-gray-900">API Key Formats</h3>
        <p>
          Every developer account is assigned two sets of secret keys:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong>Test Key:</strong> Prefixed with <code>sk_test_</code>. Use this to sign requests made to the sandbox environment.</li>
          <li><strong>Live Key:</strong> Prefixed with <code>sk_live_</code>. Use this to authenticate real monetary transactions.</li>
        </ul>

        <div className="flex items-start gap-3 p-4 bg-[#fef3c7] border border-[#fde68a] rounded-lg text-sm text-[#78350f]">
          <AlertTriangle size={18} className="flex-shrink-0 mt-0.5 text-amber-600" />
          <div>
            <span className="font-semibold">Security Alert:</span> Keep your live keys hidden. Never publish live keys to GitHub or expose them in client-side applications.
          </div>
        </div>

        <h3 className="text-base font-bold text-gray-900 font-sans">Request Format Table</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs text-left border-collapse border border-gray-200">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="p-2.5 font-bold text-gray-800">Header Name</th>
                <th className="p-2.5 font-bold text-gray-800">Value Example</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-2.5 font-semibold text-gray-700">Authorization</td>
                <td className="p-2.5 font-mono text-gray-600">Bearer sk_test_your_secret_key_here</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    ),
    codeSnippets: {
      curl: `# Request using your developer key
curl -X GET https://api.sandbox.aza.systems/v1/wallet/balance \\
  -H "Authorization: Bearer sk_test_your_secret_key"`,
      js: `// Client initialization using key configuration
import { AzaClient } from '@aza/sdk';

const client = new AzaClient({
  apiKey: 'sk_test_your_secret_key'
});`,
      python: `# Client initialization using key configuration
import aza

client = aza.Client(api_key="sk_test_your_secret_key")`,
    },
  },
  checkout: {
    id: 'checkout',
    category: 'Payments',
    title: 'Checkout Sessions',
    subtitle: 'Initiate hosted checkout payments',
    lastUpdated: 'May 2026',
    description: 'Allow customers to pay invoices on the web or in-app. The checkout endpoint returns a session URL where the customer completes the transaction safely.',
    content: (
      <div className="space-y-6">
        <h3 className="text-base font-bold text-gray-900">How Hosted Checkout Works</h3>
        <p>
          Creating a session redirects users to Aza's hosted gateway. Once payment is confirmed, Aza redirects the customer back to your application and sends a webhook alert.
        </p>

        <h3 className="text-base font-bold text-gray-900">Post Request Parameters</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs text-left border-collapse border border-gray-200">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="p-2.5 font-bold text-gray-800">Field</th>
                <th className="p-2.5 font-bold text-gray-800">Type</th>
                <th className="p-2.5 font-bold text-gray-800">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-150">
                <td className="p-2.5 font-semibold text-gray-700">amount</td>
                <td className="p-2.5 text-gray-600 font-mono">decimal</td>
                <td className="p-2.5 text-gray-600">The amount to charge the user (e.g. 15.50).</td>
              </tr>
              <tr className="border-b border-gray-150">
                <td className="p-2.5 font-semibold text-gray-700">currency</td>
                <td className="p-2.5 text-gray-600 font-mono">string</td>
                <td className="p-2.5 text-gray-600">Currency code (e.g. "USD", "EUR").</td>
              </tr>
              <tr>
                <td className="p-2.5 font-semibold text-gray-700">successUrl</td>
                <td className="p-2.5 text-gray-600 font-mono">string</td>
                <td className="p-2.5 text-gray-600">URL to redirect to upon successful checkout.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    ),
    codeSnippets: {
      curl: `# Create checkout session
curl -X POST https://api.sandbox.aza.systems/v1/checkout \\
  -H "Authorization: Bearer sk_test_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 150.00,
    "currency": "USD",
    "successUrl": "https://yourapp.com/payment/success",
    "cancelUrl": "https://yourapp.com/payment/cancel"
  }'`,
      js: `// Initiate hosted payment flow
import { AzaClient } from '@aza/sdk';
const client = new AzaClient({ apiKey: 'sk_test_your_key' });

const session = await client.checkout.createSession({
  amount: 150.00,
  currency: 'USD',
  successUrl: 'https://yourapp.com/payment/success',
  cancelUrl: 'https://yourapp.com/payment/cancel'
});

console.log(\`Redirect your user to: \${session.url}\`);`,
      python: `# Initiate hosted payment flow
import aza
client = aza.Client(api_key="sk_test_your_key")

session = client.checkout.create_session(
    amount=150.00,
    currency="USD",
    success_url="https://yourapp.com/payment/success",
    cancel_url="https://yourapp.com/payment/cancel"
)
print(f"Redirect your user to: {session.url}")`,
    },
  },
  requests: {
    id: 'requests',
    category: 'Payments',
    title: 'Payment Requests',
    subtitle: 'Request funds directly using handles',
    lastUpdated: 'May 2026',
    description: 'Use the money request API to trigger instant payment notifications inside user applications. The user receives a push prompt to verify and authorize.',
    content: (
      <div className="space-y-6">
        <h3 className="text-base font-bold text-gray-900 font-sans">Money Requests Overview</h3>
        <p>
          Instead of redirecting users to web checkout screens, you can solicit direct wallet-to-wallet transfers. The target user receives an alert inside their Aza mobile app and can authorize it with their passcode or face ID.
        </p>

        <h3 className="text-base font-bold text-gray-900">Post Request Parameters</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs text-left border-collapse border border-gray-200">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="p-2.5 font-bold text-gray-800">Field</th>
                <th className="p-2.5 font-bold text-gray-800">Type</th>
                <th className="p-2.5 font-bold text-gray-800">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-150">
                <td className="p-2.5 font-semibold text-gray-700">targetHandle</td>
                <td className="p-2.5 text-gray-600 font-mono">string</td>
                <td className="p-2.5 text-gray-600">The destination user\'s handle (e.g. "@alex").</td>
              </tr>
              <tr className="border-b border-gray-150">
                <td className="p-2.5 font-semibold text-gray-700">amount</td>
                <td className="p-2.5 text-gray-600 font-mono">decimal</td>
                <td className="p-2.5 text-gray-600">The amount to request.</td>
              </tr>
              <tr>
                <td className="p-2.5 font-semibold text-gray-700">memo</td>
                <td className="p-2.5 text-gray-600 font-mono">string</td>
                <td className="p-2.5 text-gray-600">Optional text visible to the customer.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    ),
    codeSnippets: {
      curl: `# Request payment from a user
curl -X POST https://api.sandbox.aza.systems/v1/money-requests \\
  -H "Authorization: Bearer sk_test_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "targetHandle": "@alex",
    "amount": 25.00,
    "memo": "Dinner settlement"
  }'`,
      js: `// Issue a payment request
import { AzaClient } from '@aza/sdk';
const client = new AzaClient({ apiKey: 'sk_test_your_key' });

const request = await client.moneyRequests.create({
  targetHandle: '@alex',
  amount: 25.00,
  memo: 'Dinner settlement'
});`,
      python: `# Issue a payment request
import aza
client = aza.Client(api_key="sk_test_your_key")

request = client.money_requests.create(
    target_handle="@alex",
    amount=25.00,
    memo="Dinner settlement"
)`,
    },
  },
  transfers: {
    id: 'transfers',
    category: 'Payouts',
    title: 'Direct Payouts',
    subtitle: 'Transfer funds from your wallet instantly',
    lastUpdated: 'May 2026',
    description: 'Use the transfers API to distribute money out of your dashboard balance to users, merchants, or connected bank accounts.',
    content: (
      <div className="space-y-6">
        <h3 className="text-base font-bold text-gray-900">Transfer Execution</h3>
        <p>
          Executing a transfer debits your sandbox/live developer account wallet and instantly credits the receiver.
        </p>

        <h3 className="text-base font-bold text-gray-900">Parameters Table</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs text-left border-collapse border border-gray-200">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="p-2.5 font-bold text-gray-800">Field</th>
                <th className="p-2.5 font-bold text-gray-800">Type</th>
                <th className="p-2.5 font-bold text-gray-800">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-150">
                <td className="p-2.5 font-semibold text-gray-700">recipient</td>
                <td className="p-2.5 text-gray-600 font-mono">string</td>
                <td className="p-2.5 text-gray-600">The destination user identifier or handle.</td>
              </tr>
              <tr className="border-b border-gray-150">
                <td className="p-2.5 font-semibold text-gray-700">amount</td>
                <td className="p-2.5 text-gray-600 font-mono">decimal</td>
                <td className="p-2.5 text-gray-600">Monetary value to transfer.</td>
              </tr>
              <tr>
                <td className="p-2.5 font-semibold text-gray-700">passcode</td>
                <td className="p-2.5 text-gray-600 font-mono">string</td>
                <td className="p-2.5 text-gray-600">Optional wallet secure passcode PIN.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    ),
    codeSnippets: {
      curl: `# Perform a direct transfer
curl -X POST https://api.sandbox.aza.systems/v1/transfers \\
  -H "Authorization: Bearer sk_test_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "recipient": "@jane",
    "amount": 50.00,
    "passcode": "123456"
  }'`,
      js: `// Send money programmatically
import { AzaClient } from '@aza/sdk';
const client = new AzaClient({ apiKey: 'sk_test_your_key' });

const tx = await client.transfers.create({
  recipient: '@jane',
  amount: 50.00,
  passcode: '123456'
});`,
      python: `# Send money programmatically
import aza
client = aza.Client(api_key="sk_test_your_key")

tx = client.transfers.create(
    recipient="@jane",
    amount=50.00,
    passcode="123456"
)`,
    },
  },
  'webhooks-overview': {
    id: 'webhooks-overview',
    category: 'Webhooks',
    title: 'Webhooks Overview & Setup',
    subtitle: 'Listen for real-time transaction events',
    lastUpdated: 'May 2026',
    description: 'Configure your endpoints in the dashboard to receive HTTPS POST payloads whenever transactions are completed, updated, or failed.',
    content: (
      <div className="space-y-6">
        <h3 className="text-base font-bold text-gray-900">Supported Events List</h3>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><code>transfer.completed</code>: Fired when an outgoing transfer succeeds.</li>
          <li><code>transfer.failed</code>: Fired when an outgoing transfer is aborted.</li>
          <li><code>checkout.completed</code>: Fired when a customer pays a hosted session invoice.</li>
        </ul>

        <h3 className="text-base font-bold text-gray-900">Acknowledge Responses</h3>
        <p>
          Your server must return a <code>200 OK</code> status code within 3 seconds of receiving a webhook. If Aza receives any other status or times out, it will retry sending the webhook up to 5 times with exponential backoff.
        </p>
      </div>
    ),
    codeSnippets: {
      curl: `# Test local webhook mock handler
curl -X POST http://localhost:3000/api/webhook \\
  -H "Content-Type: application/json" \\
  -d '{
    "id": "evt_098f",
    "type": "checkout.completed",
    "data": {
      "sessionId": "cs_test_abc123",
      "amount": 150.00,
      "status": "paid"
    }
  }'`,
      js: `// Example Express handler
import express from 'express';
const app = express();

app.post('/webhook', express.json(), (req, res) => {
  const event = req.body;
  
  if (event.type === 'checkout.completed') {
    const session = event.data;
    console.log(\`Received payment for session \${session.sessionId}\`);
  }
  
  res.status(200).send({ received: true });
});`,
      python: `# Example Flask handler
from flask import Flask, request, jsonify
app = Flask(__name__)

@app.route('/webhook', methods=['POST'])
def webhook():
    event = request.json
    if event['type'] == 'checkout.completed':
        data = event['data']
        print(f"Received payment for session {data['sessionId']}")
    return jsonify(received=True), 200`,
    },
  },
  'webhooks-signatures': {
    id: 'webhooks-signatures',
    category: 'Webhooks',
    title: 'Signature Verification',
    subtitle: 'Verify webhook payloads are authentic',
    lastUpdated: 'May 2026',
    description: 'Ensure payloads originate from Aza and not from impersonation. Verify signatures via SHA-256 HMAC hash functions using your secret.',
    content: (
      <div className="space-y-6">
        <h3 className="text-base font-bold text-gray-900">The X-Aza-Signature Header</h3>
        <p>
          Aza webhooks include an <code>X-Aza-Signature</code> header. The header contains a timestamp and a signature hash:
        </p>
        <pre className="p-3 bg-gray-50 border border-gray-200 rounded font-mono text-[11px] text-gray-700">
          t=1723490283,v1=f89d380e21bc82093ea08e2f89d380e21bc8209...
        </pre>
        <p>
          Compute the HMAC SHA-256 signature on the raw body string combined with the timestamp using your webhook signing secret, and confirm it matches the signature in the header.
        </p>
      </div>
    ),
    codeSnippets: {
      curl: `# Signatures cannot be easily simulated via raw curl. Use a client library code snippet.`,
      js: `// Verify signatures in Node.js
import crypto from 'crypto';

function verifySignature(payload, headerSignature, secret) {
  const [tPart, vPart] = headerSignature.split(',');
  const timestamp = tPart.split('=')[1];
  const signature = vPart.split('=')[1];
  
  const signedPayload = \`\${timestamp}.\${payload}\`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');
    
  return signature === expectedSignature;
}`,
      python: `# Verify signatures in Python
import hmac
import hashlib

def verify_signature(payload, header_signature, secret):
    t_part, v_part = header_signature.split(',')
    timestamp = tPart.split('=')[1]
    signature = v_part.split('=')[1]
    
    signed_payload = f"{timestamp}.{payload}".encode('utf-8')
    expected_sig = hmac.new(
        secret.encode('utf-8'),
        signed_payload,
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(signature, expected_sig)`,
    },
  },
};
