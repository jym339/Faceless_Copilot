import React, { useState, useEffect } from 'react';
import { Youtube, Plus, RefreshCw, Loader2, Award, Users, Play, TrendingUp, AlertCircle, ArrowUpRight } from 'lucide-react';

interface Channel {
  id: string;
  title: string;
  handle: string;
  avatar_url: string;
  subscriber_count: number;
  avg_views_longform: number;
  avg_views_shorts: number;
}

interface Video {
  id: string;
  title: string;
  thumbnail_url: string;
  view_count: number;
  outlier_multiplier: number;
  format: 'long' | 'short';
  published_at: string;
}

export default function MyChannelTab() {
  const [channel, setChannel] = useState<Channel | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchMyChannel = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('oauth_token');
      const res = await fetch('/api/my_channel', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (data.set && data.found) {
        setChannel(data.channel);
        setVideos(data.videos || []);
      } else {
        setChannel(null);
        setVideos([]);
      }
    } catch (err) {
      setError('Failed to fetch your channel data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyChannel();
  }, []);

  const handleLinkChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const token = localStorage.getItem('oauth_token');
      const res = await fetch('/api/my_channel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ identifier: identifier.trim() })
      });

      const data = await res.json();
      if (res.ok) {
        setSuccess(`Successfully linked "${data.channel.title}"! We've crawled your recent uploads and calculated your baseline metrics.`);
        setIdentifier('');
        fetchMyChannel();
      } else {
        setError(data.error || 'Failed to resolve YouTube channel.');
      }
    } catch (err: any) {
      setError('Network error resolved. Please check your YouTube API configuration.');
    } finally {
      setSaving(false);
    }
  };

  const handleUnlink = async () => {
    if (!confirm('Are you sure you want to unlink your channel?')) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('oauth_token');
      // Save empty channel ID setting
      await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ my_channel_id: '' })
      });
      // Also write empty string explicitly on the backend
      setChannel(null);
      setVideos([]);
    } catch (e) {
      setError('Unlink failed.');
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-[#05070a]">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Youtube className="text-red-500" size={24} />
            My Channel Audit
          </h1>
          <p className="text-[0.8rem] text-[var(--muted)] mt-1">
            Analyze your performance relative to your target fields. Benchmarking your own videos against your baseline is the first step to scaling outliers.
          </p>
        </div>

        {channel && (
          <button
            onClick={fetchMyChannel}
            disabled={loading}
            className="p-2 hover:bg-[#121824] border border-[var(--line)] rounded-md text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer transition-all flex items-center gap-2 text-xs font-semibold"
          >
            <RefreshCw className={loading ? 'animate-spin' : ''} size={14} />
            <span>Sync</span>
          </button>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-950/40 border border-red-900/60 text-red-300 text-xs rounded-md flex items-center gap-3">
          <AlertCircle className="shrink-0 text-red-400" size={16} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-emerald-950/40 border border-emerald-900/60 text-emerald-300 text-xs rounded-md flex items-center gap-3">
          <TrendingUp className="shrink-0 text-emerald-400" size={16} />
          <span>{success}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 gap-3">
          <Loader2 className="animate-spin text-[var(--accent)]" size={32} />
          <span className="text-xs text-[var(--muted)]">Syncing your YouTube channel statistics...</span>
        </div>
      ) : !channel ? (
        <div className="max-w-xl mx-auto my-12 bg-[#0b0f17] border border-[var(--line)] rounded-lg p-8 text-center shadow-lg">
          <Youtube className="mx-auto text-red-500 mb-4" size={56} />
          <h2 className="text-lg font-bold text-[var(--ink)]">Link Your YouTube Channel</h2>
          <p className="text-xs text-[var(--muted)] mt-2 mb-6 leading-relaxed">
            Input your custom channel handle or YouTube ID (e.g. <code>@theprimeagen</code> or <code>UC8butISFwT-Wl7EV0hUK0BQ</code>). We will analyze your performance baselines so you can study your outlier performance.
          </p>

          <form onSubmit={handleLinkChannel} className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. @MrBeast"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              className="flex-1 bg-[#121824] border border-[var(--line)] rounded px-3 py-2 text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]"
            />
            <button
              type="submit"
              disabled={saving}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold rounded px-4 py-2 text-xs flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="animate-spin" size={14} />
                  <span>Crawling...</span>
                </>
              ) : (
                <>
                  <Plus size={14} />
                  <span>Link Channel</span>
                </>
              )}
            </button>
          </form>
          <div className="mt-4 text-[10px] text-gray-500 text-left leading-normal p-3 bg-[#121824]/40 rounded border border-[var(--line)]/50">
            <strong>Note:</strong> Linking your channel requires a valid YouTube API key configured in the Settings tab.
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Channel Card Header */}
          <div className="bg-[#0b0f17] border border-[var(--line)] rounded-lg p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <img
                src={channel.avatar_url}
                alt={channel.title}
                referrerPolicy="no-referrer"
                className="w-16 h-16 rounded-full border-2 border-[var(--accent)] shadow-md"
              />
              <div>
                <h2 className="text-lg font-bold text-[var(--ink)] tracking-tight flex items-center gap-2">
                  {channel.title}
                  {channel.subscriber_count > 100000 && <Award className="text-yellow-500" size={18} />}
                </h2>
                <p className="text-xs text-[var(--muted)] font-mono">{channel.handle || channel.id}</p>
                <div className="flex gap-4 mt-2 text-xs">
                  <span className="flex items-center gap-1.5 text-[var(--muted)] font-semibold">
                    <Users size={14} className="text-blue-400" />
                    <strong className="text-[var(--ink)]">{formatNumber(channel.subscriber_count)}</strong> Subscribers
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={handleUnlink}
              className="px-3 py-1.5 border border-red-950 hover:bg-red-950/20 text-red-400 hover:text-red-300 rounded text-xs cursor-pointer transition-all self-start md:self-center"
            >
              Unlink Channel
            </button>
          </div>

          {/* Baseline Performance Indicators */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#0b0f17] border border-[var(--line)] rounded-lg p-5">
              <div className="text-[10px] uppercase tracking-wider font-mono text-[var(--muted)] mb-1">
                Avg Long-form Baseline
              </div>
              <div className="text-2xl font-bold font-mono text-[var(--ink)]">
                {formatNumber(channel.avg_views_longform)} <span className="text-xs text-[var(--muted)] font-sans font-normal">views/video</span>
              </div>
              <p className="text-[11px] text-[var(--muted)] mt-1.5">
                Calculated across your recent long-form content. Views significantly above this represent outlier triggers.
              </p>
            </div>

            <div className="bg-[#0b0f17] border border-[var(--line)] rounded-lg p-5">
              <div className="text-[10px] uppercase tracking-wider font-mono text-[var(--muted)] mb-1">
                Avg Shorts Baseline
              </div>
              <div className="text-2xl font-bold font-mono text-[var(--ink)]">
                {formatNumber(channel.avg_views_shorts)} <span className="text-xs text-[var(--muted)] font-sans font-normal">views/short</span>
              </div>
              <p className="text-[11px] text-[var(--muted)] mt-1.5">
                Calculated across your shorts. Keep Shorts and long-form separate for hyper-accurate multiplier benchmarks.
              </p>
            </div>
          </div>

          {/* Videos List */}
          <div className="bg-[#0b0f17] border border-[var(--line)] rounded-lg p-6">
            <h3 className="text-sm font-semibold mb-4 text-[var(--ink)] flex items-center gap-2">
              <Play size={14} className="text-[var(--accent)]" /> Recent Video Performance & Multipliers
            </h3>

            {videos.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-[var(--line)] rounded bg-[#121824]/20">
                <span className="text-xs text-[var(--muted)]">No video data found. Check back in a bit!</span>
              </div>
            ) : (
              <div className="space-y-4">
                {videos.map((vid) => {
                  const isOutlier = vid.outlier_multiplier >= 1.5;
                  return (
                    <div
                      key={vid.id}
                      className="p-4 bg-[#121824] hover:bg-[#161d2b] border border-[var(--line)] rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all"
                    >
                      <div className="flex gap-4 items-center">
                        <div>
                          <h4 className="text-xs font-bold text-[var(--ink)] leading-snug line-clamp-1">
                            {vid.title}
                          </h4>
                          <div className="flex gap-2 items-center mt-1 text-[10px] text-[var(--muted)] flex-wrap">
                            <span className="px-1.5 py-0.25 rounded bg-[#1f293d] font-mono uppercase text-[9px]">
                              {vid.format}
                            </span>
                            <span>•</span>
                            <span>{formatNumber(vid.view_count)} views</span>
                            <span>•</span>
                            <span>{new Date(vid.published_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                        <div className="text-right">
                          <div className="text-[10px] font-mono text-[var(--muted)]">Multiplier</div>
                          <div className={`text-sm font-black font-mono flex items-center gap-1 justify-end ${
                            isOutlier ? 'text-emerald-400' : 'text-[var(--ink)]'
                          }`}>
                            {vid.outlier_multiplier.toFixed(1)}x
                            {isOutlier && <ArrowUpRight size={14} className="text-emerald-400" />}
                          </div>
                        </div>

                        {isOutlier && (
                          <span className="px-2 py-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-900 text-[9px] font-extrabold uppercase tracking-wide">
                            OUTLIER
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
