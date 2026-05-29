"use client";

export default function SettingsPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Settings</h1>
      <p className="text-gray-500 mb-8">Configure your SALUS API credentials to connect the dashboard.</p>

      {/* Step 1 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-8 h-8 rounded-full bg-blue-700 text-white flex items-center justify-center font-bold text-sm shrink-0">1</div>
          <div className="flex-1">
            <h2 className="font-semibold text-gray-900 mb-1">Get your SALUS API credentials</h2>
            <p className="text-gray-500 text-sm mb-3">
              Log in to your SALUS account at{" "}
              <a href="https://portal.salussafety.io" target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">
                portal.salussafety.io
              </a>{" "}
              with a <strong>company_owner</strong> account. Navigate to your account settings and look
              for <strong>API / Developer Access</strong> to generate a Client ID and Client Secret.
            </p>
            <p className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
              💡 If you don't see an API section, contact{" "}
              <a href="mailto:support@salussafety.io" className="underline">support@salussafety.io</a>{" "}
              and ask them to enable API access for your account.
            </p>
          </div>
        </div>
      </div>

      {/* Step 2 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-8 h-8 rounded-full bg-blue-700 text-white flex items-center justify-center font-bold text-sm shrink-0">2</div>
          <div className="flex-1">
            <h2 className="font-semibold text-gray-900 mb-1">Add credentials to Vercel</h2>
            <p className="text-gray-500 text-sm mb-3">
              In your Vercel project, go to <strong>Settings → Environment Variables</strong> and add
              the following:
            </p>
            <div className="bg-gray-900 rounded-lg p-4 text-sm font-mono space-y-2">
              <div>
                <span className="text-green-400">SALUS_CLIENT_ID</span>
                <span className="text-gray-400"> = </span>
                <span className="text-yellow-300">your_client_id</span>
              </div>
              <div>
                <span className="text-green-400">SALUS_CLIENT_SECRET</span>
                <span className="text-gray-400"> = </span>
                <span className="text-yellow-300">your_client_secret</span>
              </div>
              <div>
                <span className="text-green-400">SALUS_TOKEN_URL</span>
                <span className="text-gray-400"> = </span>
                <span className="text-blue-300">https://guardian.beta.salussafety.io/token</span>
              </div>
              <div>
                <span className="text-green-400">SALUS_API_BASE</span>
                <span className="text-gray-400"> = </span>
                <span className="text-blue-300">https://developer.beta.salussafety.io</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Step 3 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-8 h-8 rounded-full bg-blue-700 text-white flex items-center justify-center font-bold text-sm shrink-0">3</div>
          <div className="flex-1">
            <h2 className="font-semibold text-gray-900 mb-1">Redeploy and verify</h2>
            <p className="text-gray-500 text-sm mb-3">
              After adding your environment variables in Vercel, trigger a redeploy (Vercel will
              prompt you or you can click <strong>Redeploy</strong> from the Deployments tab). Then
              come back to the{" "}
              <a href="/" className="text-blue-700 underline">dashboard</a> — it should connect
              automatically.
            </p>
            <div className="flex gap-3">
              <a
                href="/"
                className="inline-block bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium text-sm hover:bg-blue-800 transition-colors"
              >
                ← Back to Dashboard
              </a>
              <a
                href="https://vercel.com/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-gray-100 text-gray-700 px-5 py-2.5 rounded-lg font-medium text-sm hover:bg-gray-200 transition-colors"
              >
                Open Vercel ↗
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Reference */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1">📄 SALUS API Documentation</p>
        <p>
          Full API reference:{" "}
          <a href="https://docs.salussafety.io/reference/getting-started" target="_blank" rel="noopener noreferrer" className="underline">
            docs.salussafety.io/reference/getting-started
          </a>
        </p>
        <p className="mt-1">
          Authentication guide:{" "}
          <a href="https://docs.salussafety.io/docs/authentication" target="_blank" rel="noopener noreferrer" className="underline">
            docs.salussafety.io/docs/authentication
          </a>
        </p>
      </div>
    </div>
  );
}
