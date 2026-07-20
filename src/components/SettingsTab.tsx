import React, { useState, useEffect } from 'react';
import { Key, ShieldCheck, RefreshCw, Server, AlertTriangle } from 'lucide-react';

export default function SettingsTab() {
  const [apiKey, setApiKey] = useState('');
  const [quotaUsed, setQuotaUsed] = useState(0);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('oauth_token');
      const res = await fetch('/api/settings', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const data = await res.json();
      setApiKey(data.youtube_api_key || '');
      setQuotaUsed(data.quota_used || 0);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatus('');
    try {
      const token = localStorage.getItem('oauth_token');
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ youtube_api_key: apiKey.trim() }),
      });
      if (res.ok) {
        setStatus('Credentials updated successfully!');
        fetchSettings();
      } else {
        setStatus('Failed to update credentials.');
      }
    } catch (err) {
      setStatus('Network connection error.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-[#05070a]">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">System Settings</h1>
        <p className="text-[0.8rem] text-[var(--muted)] mt-1">
          Configure your secure public YouTube API v3 credentials and monitor current unit metrics.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-8 max-w-4xl">
        {/* Credentials Form */}
        <div className="bg-[var(--card-bg)] border border-[var(--line)] rounded-xl p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--muted)] mb-4 flex items-center gap-2">
              <Key size={14} className="text-[var(--accent)]" /> YouTube API Credentials
            </h2>
            
            <p className="text-xs text-[var(--muted)] font-mono leading-relaxed mb-4">
              Enter your standard public YouTube API v3 browser/server token. No personal Google Account authorization or channel logins are required.
            </p>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs text-[var(--muted)] font-semibold mb-1.5">YouTube API v3 Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)] px-3 py-2 rounded-lg text-sm outline-none font-mono focus:border-[var(--accent)]"
                  required
                />
              </div>

              {status && (
                <div className={`text-xs font-semibold ${status.includes('successfully') ? 'text-emerald-400' : 'text-red-400'}`}>
                  {status}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="bg-[var(--accent)] text-white text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer hover:opacity-90 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Credentials'}
              </button>
            </form>
          </div>
        </div>

        {/* Quota Dashboard Card */}
        <div className="bg-[var(--card-bg)] border border-[var(--line)] rounded-xl p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--muted)] mb-4 flex items-center gap-2">
              <Server size={14} className="text-[var(--accent)]" /> API Quota Consumed
            </h2>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-mono text-[var(--muted)] mb-1.5">
                  <span>Quota Consumed:</span>
                  <span className="font-semibold text-[var(--ink)]">{quotaUsed.toLocaleString()} / 10,000 units</span>
                </div>
                <div className="h-2 bg-[#1e293b] rounded-full overflow-hidden">
                  <div 
                    className="bg-[var(--accent)] h-full transition-all duration-500"
                    style={{ width: `${Math.min((quotaUsed / 10000) * 100, 100)}%` }}
                  />
                </div>
              </div>

              <div className="bg-[#1e293b]/20 border border-[var(--line)] p-3 rounded-lg flex items-start gap-2 text-xs text-[var(--muted)]">
                <AlertTriangle className="shrink-0 text-[var(--accent)] mt-0.5" size={14} />
                <div className="font-mono leading-relaxed text-[0.7rem]">
                  YouTube grants 10,000 free quota units per day. 
                  <br />- <strong>Keyword Search</strong>: 100 units
                  <br />- <strong>Metrics crawl (Video/Channel detail)</strong>: 1 unit
                  <br />Outlier results are cached locally to conserve your daily quota automatically.
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={fetchSettings}
            className="mt-6 border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-slate-900/40 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <RefreshCw size={12} /> Sync Dashboard Metrics
          </button>
        </div>

        {/* Google OAuth & Sign-In Setup Card */}
        <div className="col-span-2 bg-[var(--card-bg)] border border-[var(--line)] rounded-xl p-6 mt-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--muted)] mb-4 flex items-center gap-2">
            <ShieldCheck size={14} className="text-[var(--accent)]" /> Google OAuth & Sign-In Setup
          </h2>
          <p className="text-xs text-[var(--muted)] font-mono leading-relaxed mb-4">
            If you encounter a <strong>redirect_uri_mismatch</strong> or <strong>invalid_request</strong> error when signing in, make sure your Authorized Redirect URIs match your current environment below.
          </p>

          <div className="space-y-4">
            <div className="bg-[#1e293b]/20 border border-[var(--line)] p-4 rounded-lg">
              <h3 className="text-xs font-bold text-[var(--ink)] mb-2">Step 1: Configure Authorized Redirect URIs</h3>
              <p className="text-xs text-[var(--muted)] mb-3">
                Go to the <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">Google Cloud Console → APIs & Services → Credentials</a>, select your OAuth 2.0 Client ID, and add this exact URL under the <strong>Authorized redirect URIs</strong> list:
              </p>
              
              <div className="flex items-center justify-between gap-2 bg-[var(--bg)] border border-[var(--line)] p-2.5 rounded-md font-mono text-xs text-[var(--accent)] overflow-x-auto">
                <span className="select-all">{window.location.origin}/auth/callback</span>
                <span className="text-[10px] text-[var(--muted)] uppercase tracking-wider px-1.5 py-0.5 bg-[var(--card-bg)] border border-[var(--line)] rounded">Active URL</span>
              </div>
            </div>

            <div className="bg-[#1e293b]/20 border border-[var(--line)] p-4 rounded-lg">
              <h3 className="text-xs font-bold text-[var(--ink)] mb-2">Step 2: Configure Environment Secrets</h3>
              <p className="text-xs text-[var(--muted)] mb-1">
                Make sure you have set the following secrets under the <strong>Settings → Secrets</strong> menu of your AI Studio workspace:
              </p>
              <ul className="list-disc list-inside text-xs text-[var(--muted)] font-mono space-y-1 mt-2 pl-2">
                <li><code>CLIENT_ID</code></li>
                <li><code>CLIENT_SECRET</code></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
