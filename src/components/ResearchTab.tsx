import React, { useState, useEffect } from 'react';
import { 
  Search, Plus, TrendingUp, AlertCircle, Sparkles, 
  SlidersHorizontal, ArrowUpDown, Filter, Eye, Users, 
  Play, Calendar, RotateCcw, X, RefreshCw, Flame, HelpCircle,
  CheckCircle2, Loader2, Info, Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Video } from '../types';

interface ResearchTabProps {
  onAddChannel: (identifier: string) => Promise<void>;
  watchlistChannelIds: string[];
}

const POPULAR_RESEARCH_PRESETS = [
  { label: 'WWII Documentaries', value: 'WWII documentary' },
  { label: 'True Crime', value: 'crime investigation stories' },
  { label: 'Deep Space', value: 'deep space exploration documentary' },
  { label: 'Retro Tech', value: 'vintage computing retro tech' },
  { label: 'Cabin Builds', value: 'diy cabin off grid building' }
];

const isWithinLast30Days = (publishedAt: string): boolean => {
  if (!publishedAt) return false;
  const publishedDate = new Date(publishedAt).getTime();
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  return publishedDate >= thirtyDaysAgo;
};

export default function ResearchTab({ onAddChannel, watchlistChannelIds }: ResearchTabProps) {
  const [query, setQuery] = useState('WWII documentary');
  const [results, setResults] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [addingId, setAddingId] = useState<string | null>(null);

  // Filter & Sort states
  const [maxSubs, setMaxSubs] = useState<string>('all');
  const [minViews, setMinViews] = useState<string>('all');
  const [minMultiplier, setMinMultiplier] = useState<string>('all');
  const [formatFilter, setFormatFilter] = useState<'all' | 'long' | 'short'>('all');
  const [sortBy, setSortBy] = useState<string>('multiplier');
  
  // Custom Focus state for Giant Slayers (<50k subs & >1M views)
  const [giantSlayerFocus, setGiantSlayerFocus] = useState<boolean>(false);

  // Real-time progress visual feedback states
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [progressStep, setProgressStep] = useState<string>('');
  const [toast, setToast] = useState<{ id: number; message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const toastId = Date.now();
    setToast({ id: toastId, message, type });
    setTimeout(() => {
      setToast(current => {
        if (current && current.id === toastId) {
          return null;
        }
        return current;
      });
    }, 5000);
  };

  // Run initial loading on mount
  useEffect(() => {
    fetchResearch(query);
  }, []);

  const fetchResearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setError('');
    setProgressPercent(1);
    setProgressStep('Establishing connection to Google APIs...');

    // Progress Simulation Intervals
    const steps = [
      { max: 15, step: 'Connecting to YouTube API & sending primary query...' },
      { max: 35, step: 'Retrieving page 1 of search results (50 videos)...' },
      { max: 55, step: 'Retrieving page 2 of search results (50 videos)...' },
      { max: 75, step: 'Resolving comprehensive statistics (views, like count, duration)...' },
      { max: 90, step: 'Batch querying subscriber data & processing custom URLs...' },
      { max: 98, step: 'Calculating outlier multipliers & aligning database values...' }
    ];

    let currentStepIdx = 0;
    const progressInterval = setInterval(() => {
      setProgressPercent((prev) => {
        const targetMax = steps[currentStepIdx]?.max || 99;
        const currentText = steps[currentStepIdx]?.step || 'Finalizing data layout...';
        setProgressStep(currentText);

        if (prev < targetMax) {
          return prev + 1;
        } else if (currentStepIdx < steps.length - 1) {
          currentStepIdx++;
          return prev + 1;
        }
        return prev;
      });
    }, 90);

    try {
      const token = localStorage.getItem('oauth_token');
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ query: searchQuery.trim() }),
      });
      const data = await res.json();
      clearInterval(progressInterval);

      if (res.ok) {
        // Deduplicate videos by ID to guarantee unique React keys
        const uniqueVideos: Video[] = [];
        const seen = new Set<string>();
        if (Array.isArray(data)) {
          for (const item of data) {
            if (item && item.id && !seen.has(item.id)) {
              seen.add(item.id);
              uniqueVideos.push(item);
            }
          }
        }
        setResults(uniqueVideos);
        setProgressPercent(100);
        setProgressStep('Analysis complete! 100 items populated.');
        
        // Find how many Giant Slayers are in this new batch
        const giantSlayerCount = uniqueVideos.filter(v => v.subscriber_count < 50000 && v.view_count >= 1000000 && isWithinLast30Days(v.published_at)).length;
        if (giantSlayerCount > 0) {
          showToast(`Research finished! Loaded 100 videos and found ${giantSlayerCount} Giant Slayers! ⚡`, 'success');
        } else {
          showToast(`Research complete! Successfully analyzed 100 videos.`, 'success');
        }
      } else {
        setProgressPercent(0);
        const errorMsg = data.error || 'Failed to execute search. Check your API key under Settings.';
        setError(errorMsg);
        showToast(errorMsg, 'error');
      }
    } catch (err) {
      clearInterval(progressInterval);
      setProgressPercent(0);
      const errorMsg = 'Network error. Check connection or console logs.';
      setError(errorMsg);
      showToast(errorMsg, 'error');
    } finally {
      clearInterval(progressInterval);
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchResearch(query);
  };

  const handleRefresh = () => {
    fetchResearch(query);
  };

  const handlePresetClick = (presetValue: string) => {
    setQuery(presetValue);
    fetchResearch(presetValue);
  };

  const handleAdd = async (channelId: string) => {
    setAddingId(channelId);
    try {
      await onAddChannel(channelId);
    } catch (err) {
      console.error(err);
    } finally {
      setAddingId(null);
    }
  };

  const handleResetFilters = () => {
    setMaxSubs('all');
    setMinViews('all');
    setMinMultiplier('all');
    setFormatFilter('all');
    setSortBy('multiplier');
    setGiantSlayerFocus(false);
  };

  const downloadCSV = () => {
    if (sortedResults.length === 0) {
      showToast('No videos available to export.', 'error');
      return;
    }

    const headers = [
      'Video ID',
      'Title',
      'Channel Name',
      'Channel ID',
      'Subscriber Count',
      'View Count',
      'Outlier Multiplier',
      'Format',
      'Duration (Seconds)',
      'Published At',
      'Thumbnail URL'
    ];

    const rows = sortedResults.map(v => [
      v.id,
      `"${(v.title || '').replace(/"/g, '""')}"`,
      `"${(v.channel_name || '').replace(/"/g, '""')}"`,
      v.channel_id || '',
      v.subscriber_count || 0,
      v.view_count || 0,
      (v.outlier_multiplier || 1.0).toFixed(2),
      v.format || 'long',
      v.duration_seconds || 0,
      v.published_at || '',
      v.thumbnail_url || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    
    const sanitizedQuery = query.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'export';
    const fileName = `youtube-research-${sanitizedQuery}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast(`Successfully downloaded CSV with ${sortedResults.length} analyzed videos!`, 'success');
  };

  const getSubLimit = (val: string) => {
    if (val === 'all') return Infinity;
    return parseInt(val, 10);
  };

  const getViewLimit = (val: string) => {
    if (val === 'all') return 0;
    return parseInt(val, 10);
  };

  const getMultiplierLimit = (val: string) => {
    if (val === 'all') return 0;
    return parseFloat(val);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Pre-calculate count of Giant Slayers
  const totalGiantSlayersCount = results.filter(v => v.subscriber_count < 50000 && v.view_count >= 1000000 && isWithinLast30Days(v.published_at)).length;

  // Filter and sort computation
  const filteredResults = results.filter(video => {
    // If Giant Slayers focus is active, override standard filters
    if (giantSlayerFocus) {
      return video.subscriber_count < 50000 && video.view_count >= 1000000 && isWithinLast30Days(video.published_at);
    }

    if (formatFilter !== 'all' && video.format !== formatFilter) return false;
    
    const subLimit = getSubLimit(maxSubs);
    if (video.subscriber_count > subLimit) return false;

    const viewLimit = getViewLimit(minViews);
    if (video.view_count < viewLimit) return false;

    const multLimit = getMultiplierLimit(minMultiplier);
    if (video.outlier_multiplier < multLimit) return false;

    return true;
  });

  const sortedResults = [...filteredResults].sort((a, b) => {
    if (sortBy === 'multiplier') {
      return b.outlier_multiplier - a.outlier_multiplier;
    }
    if (sortBy === 'views') {
      return b.view_count - a.view_count;
    }
    if (sortBy === 'subs_asc') {
      return a.subscriber_count - b.subscriber_count;
    }
    if (sortBy === 'subs_desc') {
      return b.subscriber_count - a.subscriber_count;
    }
    if (sortBy === 'newest') {
      return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
    }
    return 0;
  });

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-[#05070a] relative">
      {/* Animated Floating Toast Notifications */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed top-6 right-6 z-50 max-w-sm w-full"
          >
            <div className={`p-4 rounded-xl border shadow-2xl flex items-start gap-3 backdrop-blur-md ${
              toast.type === 'success' 
                ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-100 shadow-emerald-500/10'
                : toast.type === 'error'
                  ? 'bg-red-950/90 border-red-500/50 text-red-100 shadow-red-500/10'
                  : 'bg-slate-900/90 border-slate-700/50 text-slate-100 shadow-black/40'
            }`}>
              {toast.type === 'success' && <CheckCircle2 className="text-emerald-400 shrink-0 mt-0.5" size={18} />}
              {toast.type === 'error' && <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={18} />}
              {toast.type === 'info' && <Info className="text-indigo-400 shrink-0 mt-0.5" size={18} />}
              
              <div className="flex-1">
                <div className="text-[9px] font-bold font-mono tracking-wider uppercase mb-0.5 opacity-60">
                  {toast.type === 'success' ? 'Task Successful' : toast.type === 'error' ? 'Task Failed' : 'System Update'}
                </div>
                <p className="text-xs leading-relaxed">{toast.message}</p>
              </div>

              <button 
                onClick={() => setToast(null)}
                className="text-slate-400 hover:text-white p-0.5 rounded-lg hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            Keyword Research & Channel Sniping
            <span className="text-xs bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-900/50 font-mono">
              100 videos
            </span>
          </h1>
          <p className="text-[0.8rem] text-[var(--muted)] mt-1">
            Search YouTube to auto-analyze 100 videos. Spot small channels with massive viral outliers (<span className="text-amber-400 font-semibold">Under 50K subs, Over 1M views & uploaded in the last 30 days</span>).
          </p>
        </div>

        {results.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
            <button
              onClick={downloadCSV}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-950/10 hover:bg-emerald-950/30 text-emerald-300 transition-all text-xs font-semibold cursor-pointer disabled:opacity-50"
              title="Download results as a CSV for offline analysis"
            >
              <Download size={13} className="text-emerald-400" />
              Download CSV ({sortedResults.length})
            </button>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--card-bg)] hover:bg-[#121824] transition-all text-xs font-semibold text-slate-300 cursor-pointer disabled:opacity-50"
              title="Refresh the current search list of channels & video statistics"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin text-[var(--accent)]' : 'text-slate-400'} />
              Refresh Results
            </button>
          </div>
        )}
      </div>

      {/* Quick Presets Bar */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase font-mono font-bold text-[var(--muted)] tracking-wider mr-1">
          Niche Presets:
        </span>
        {POPULAR_RESEARCH_PRESETS.map((preset) => (
          <button
            key={preset.value}
            onClick={() => handlePresetClick(preset.value)}
            disabled={loading}
            className={`text-xs px-3 py-1 rounded-full border font-mono transition-all cursor-pointer ${
              query === preset.value
                ? 'bg-indigo-950/40 text-indigo-300 border-indigo-500/50'
                : 'bg-[#0b0f17] text-slate-400 border-[var(--line)] hover:border-slate-600'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2 max-w-2xl mb-8">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-3 text-[var(--muted)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. WWII documentary, trucking stories, space documentary..."
            className="w-full bg-[var(--card-bg)] border border-[var(--line)] text-[var(--ink)] pl-10 pr-4 py-2.5 rounded-lg text-sm outline-none focus:border-[var(--accent)]"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="bg-[var(--accent)] hover:opacity-90 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
        >
          {loading ? 'Sniping 100 Videos...' : 'Snipe Niches'}
        </button>
      </form>

      {error && (
        <div className="bg-red-950/30 border border-red-900/50 p-4 rounded-lg flex items-start gap-3 text-sm text-red-200 mb-6 max-w-2xl">
          <AlertCircle className="shrink-0 text-red-400 mt-0.5" size={16} />
          <div>{error}</div>
        </div>
      )}

      {loading && (
        <div className="my-8 bg-[#0b0f17] border border-[var(--line)] rounded-xl p-6 max-w-2xl mx-auto shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <RefreshCw className="animate-spin text-[var(--accent)]" size={18} />
              <span className="font-mono text-xs font-bold text-slate-300 uppercase tracking-wider">
                ACTIVE SNIPE PROCESS
              </span>
            </div>
            <span className="font-mono text-sm font-bold text-[var(--accent)]">
              {progressPercent}%
            </span>
          </div>

          {/* Progress bar track */}
          <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800/80 mb-6">
            <div 
              className="bg-gradient-to-r from-indigo-500 via-[var(--accent)] to-emerald-500 h-full rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="mb-4">
            <div className="text-sm font-semibold text-white mb-1 flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-400 animate-pulse" />
              <span>{progressStep}</span>
            </div>
            <p className="text-xs text-[var(--muted)] font-mono">
              Analyzing 100 videos across YouTube search, detailed duration statistics, and subscriber size database maps.
            </p>
          </div>

          {/* Stepper Checklist */}
          <div className="space-y-2 mt-6 border-t border-slate-800/80 pt-4">
            {[
              { label: 'Connecting & Authenticating with YouTube API', threshold: 15 },
              { label: 'Extracting search results Page 1 (first 50 videos)', threshold: 35 },
              { label: 'Extracting search results Page 2 (next 50 videos)', threshold: 55 },
              { label: 'Resolving full details (durations, views, titles)', threshold: 75 },
              { label: 'Resolving channel sizes, subscribers & handles', threshold: 90 },
              { label: 'Finalizing outlier multipliers & SQLite caching', threshold: 98 },
            ].map((s, index) => {
              const isCompleted = progressPercent >= s.threshold;
              const isActive = !isCompleted && (index === 0 || progressPercent >= (index > 0 ? [15, 35, 55, 75, 90, 98][index - 1] : 0));
              return (
                <div key={index} className="flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border text-[9px] font-bold ${
                      isCompleted 
                        ? 'bg-emerald-950 border-emerald-500 text-emerald-400' 
                        : isActive 
                          ? 'bg-indigo-950/50 border-indigo-500 text-indigo-300'
                          : 'bg-slate-900/50 border-slate-800 text-slate-600'
                    }`}>
                      {isCompleted ? '✓' : index + 1}
                    </div>
                    <span className={isCompleted ? 'text-slate-400 line-through' : isActive ? 'text-slate-200 font-semibold' : 'text-slate-600'}>
                      {s.label}
                    </span>
                  </div>
                  <span className={`text-[10px] ${isCompleted ? 'text-emerald-500 font-semibold' : isActive ? 'text-indigo-400 animate-pulse font-semibold' : 'text-slate-700'}`}>
                    {isCompleted ? 'Complete' : isActive ? 'Processing...' : 'Pending'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Advanced Segment and Filter Deck */}
      {!loading && results.length > 0 && (
        <div className="mb-6 bg-[#0b0f17] border border-[var(--line)] rounded-xl p-4 md:p-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4 pb-4 border-b border-[var(--line)]/50">
            <div className="flex flex-wrap items-center gap-2">
              <SlidersHorizontal className="text-[var(--accent)]" size={16} />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                Segment Sniped Videos
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-[var(--line)] text-[var(--muted)] rounded-full font-bold">
                {sortedResults.length} of {results.length} matched
              </span>
            </div>

            {/* Giant Slayers Focus Toggle Option (subs < 50k & views > 1M) */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setGiantSlayerFocus(!giantSlayerFocus);
                  if (!giantSlayerFocus) {
                    // Set friendly helper selections
                    setMaxSubs('50000');
                    setMinViews('1000000');
                  }
                }}
                className={`flex items-center gap-2 text-xs px-3.5 py-1.5 rounded-lg border font-mono font-semibold transition-all cursor-pointer ${
                  giantSlayerFocus 
                    ? 'bg-amber-950/50 text-amber-300 border-amber-500 animate-pulse'
                    : 'bg-[#121824] text-slate-400 border-[var(--line)] hover:text-white'
                }`}
              >
                <Flame size={14} className={giantSlayerFocus ? 'text-amber-400' : 'text-slate-500'} />
                Focus on Giant Slayers (&lt;50k subs, &gt;1M views & &lt;30d old)
                {totalGiantSlayersCount > 0 && (
                  <span className="bg-amber-500 text-slate-950 px-1.5 py-0.2 text-[9px] rounded font-bold ml-1">
                    {totalGiantSlayersCount} Found
                  </span>
                )}
              </button>

              {(maxSubs !== 'all' || minViews !== 'all' || minMultiplier !== 'all' || formatFilter !== 'all' || sortBy !== 'multiplier' || giantSlayerFocus) && (
                <button
                  onClick={handleResetFilters}
                  className="text-[10px] font-bold font-mono text-[var(--accent)] hover:underline flex items-center gap-1 cursor-pointer transition-all"
                >
                  <RotateCcw size={11} />
                  Reset
                </button>
              )}
            </div>
          </div>

          <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 ${giantSlayerFocus ? 'opacity-45 pointer-events-none' : ''}`}>
            {/* 1. Subscriber Count (Max Limit) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold font-mono text-[var(--muted)] uppercase tracking-wider flex items-center gap-1">
                <Users size={11} /> Max Channel Subs
              </label>
              <select
                value={maxSubs}
                onChange={(e) => setMaxSubs(e.target.value)}
                className="bg-[#121824] border border-[var(--line)] text-slate-300 text-xs rounded-lg p-2 outline-none focus:border-[var(--accent)] transition-all cursor-pointer font-mono"
              >
                <option value="all">Any Subscriber Count</option>
                <option value="10000">Under 10K (Micro Giants)</option>
                <option value="50000">Under 50K (Tiny Giants)</option>
                <option value="100000">Under 100K (Emerging)</option>
                <option value="500000">Under 500K (Mid-Tier)</option>
                <option value="1000000">Under 1M (Sub-Million)</option>
              </select>
            </div>

            {/* 2. Minimum Views */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold font-mono text-[var(--muted)] uppercase tracking-wider flex items-center gap-1">
                <Eye size={11} /> Min View Count
              </label>
              <select
                value={minViews}
                onChange={(e) => setMinViews(e.target.value)}
                className="bg-[#121824] border border-[var(--line)] text-slate-300 text-xs rounded-lg p-2 outline-none focus:border-[var(--accent)] transition-all cursor-pointer font-mono"
              >
                <option value="all">Any View Count</option>
                <option value="10000">&gt; 10K views</option>
                <option value="50000">&gt; 50K views</option>
                <option value="100000">&gt; 100K views</option>
                <option value="500000">&gt; 500K views</option>
                <option value="1000000">&gt; 1M views (Viral)</option>
              </select>
            </div>

            {/* 3. Outlier Multiplier */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold font-mono text-[var(--muted)] uppercase tracking-wider flex items-center gap-1">
                <TrendingUp size={11} /> Min Outlier Multiplier
              </label>
              <select
                value={minMultiplier}
                onChange={(e) => setMinMultiplier(e.target.value)}
                className="bg-[#121824] border border-[var(--line)] text-slate-300 text-xs rounded-lg p-2 outline-none focus:border-[var(--accent)] transition-all cursor-pointer font-mono"
              >
                <option value="all">Any Multiplier</option>
                <option value="1.5">&gt; 1.5x Outlier</option>
                <option value="2.0">&gt; 2.0x (Solid Outlier)</option>
                <option value="3.0">&gt; 3.0x (Extreme Outlier)</option>
                <option value="5.0">&gt; 5.0x (Mega Viral)</option>
              </select>
            </div>

            {/* 4. Format */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold font-mono text-[var(--muted)] uppercase tracking-wider flex items-center gap-1">
                <Play size={11} /> Content Format
              </label>
              <select
                value={formatFilter}
                onChange={(e) => setFormatFilter(e.target.value as any)}
                className="bg-[#121824] border border-[var(--line)] text-slate-300 text-xs rounded-lg p-2 outline-none focus:border-[var(--accent)] transition-all cursor-pointer font-mono"
              >
                <option value="all">All Formats</option>
                <option value="long">Long-form (&gt; 60s)</option>
                <option value="short">Shorts (&lt; 60s)</option>
              </select>
            </div>

            {/* 5. Sort By */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold font-mono text-[var(--muted)] uppercase tracking-wider flex items-center gap-1">
                <ArrowUpDown size={11} /> Sort Performance
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-[#121824] border border-[var(--line)] text-slate-300 text-xs rounded-lg p-2 outline-none focus:border-[var(--accent)] transition-all cursor-pointer font-mono"
              >
                <option value="multiplier">Outlier Multiplier (High to Low)</option>
                <option value="views">View Count (High to Low)</option>
                <option value="subs_asc">Subscribers (Low to High)</option>
                <option value="subs_desc">Subscribers (High to Low)</option>
                <option value="newest">Upload Date (Newest First)</option>
              </select>
            </div>
          </div>
          {giantSlayerFocus && (
            <div className="mt-3 text-xs text-amber-300 font-mono flex items-center gap-1.5 bg-amber-950/20 border border-amber-900/30 p-2.5 rounded-lg">
              <Flame size={13} className="animate-bounce" />
              <span>Giant Slayer mode active: Filtering 100 sniped videos to prioritize small channels (<strong>&lt; 50k subs</strong>) with explosive views (<strong>&gt; 1M views</strong>) uploaded in the last 30 days. Normal filter deck has been focused.</span>
            </div>
          )}
        </div>
      )}

      {!loading && results.length > 0 && (
        <>
          {sortedResults.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {sortedResults.map((video) => {
                const isAlreadyAdded = watchlistChannelIds.includes(video.channel_id);
                const isHighOutlier = video.outlier_multiplier >= 3.0;
                const isGiantSlayer = video.subscriber_count < 50000 && video.view_count >= 1000000 && isWithinLast30Days(video.published_at);

                return (
                  <div key={video.id} className={`card rounded-xl overflow-hidden relative flex flex-col group transition-all bg-[var(--card-bg)] border ${
                    isGiantSlayer 
                      ? 'border-amber-500/70 shadow-lg shadow-amber-500/5 hover:border-amber-400' 
                      : 'border-[var(--line)] hover:border-[var(--accent)]'
                  }`}>
                    {/* Video Thumbnail Wrapper */}
                    <a 
                      href={`https://youtube.com/watch?v=${video.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative block aspect-video w-full overflow-hidden bg-slate-950 cursor-pointer border-b border-[var(--line)]/50"
                    >
                      {video.thumbnail_url ? (
                        <img 
                          src={video.thumbnail_url} 
                          alt={video.title} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                          <Play size={24} className="text-slate-600" />
                        </div>
                      )}
                      
                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center text-white shadow-lg transform scale-90 group-hover:scale-100 transition-all duration-200">
                          <Play size={18} fill="currentColor" className="ml-0.5" />
                        </div>
                      </div>

                      {/* Duration Badge */}
                      <span className="absolute bottom-2 right-2 text-[10px] bg-black/85 backdrop-blur-xs text-slate-200 px-1.5 py-0.5 rounded font-mono font-bold border border-white/10">
                        {formatDuration(video.duration_seconds)}
                      </span>
                    </a>

                    <div className="p-4 flex flex-col flex-1">
                      {/* Top Badges Row */}
                      <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
                        <div className={`outlier-badge text-xs px-2 py-0.5 rounded font-bold flex items-center gap-1 shadow-md ${
                          isHighOutlier ? 'bg-[var(--accent)] text-white animate-pulse' : 'bg-[#1e293b] text-slate-300 border border-[var(--line)]'
                        }`}>
                          {video.outlier_multiplier.toFixed(1)}x {isHighOutlier && <Sparkles size={11} />}
                        </div>
                        {isGiantSlayer && (
                          <div className="bg-gradient-to-r from-amber-500 to-red-600 text-white text-[10px] px-2 py-0.5 rounded font-extrabold flex items-center gap-1 shadow-md animate-pulse">
                            <Flame size={10} /> GIANT SLAYER
                          </div>
                        )}
                        <span className="text-[10px] text-slate-500 font-mono ml-auto">
                          ID: {video.id}
                        </span>
                      </div>

                      <a 
                        href={`https://youtube.com/watch?v=${video.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-sm md:text-[0.95rem] leading-snug line-clamp-2 h-[2.5rem] mb-2 text-[var(--ink)] hover:text-[var(--accent)] transition-colors block"
                        title={video.title}
                      >
                        {video.title}
                      </a>

                      <div className="text-xs text-[var(--muted)] flex justify-between items-center mb-4 font-mono">
                        <span>{formatNumber(video.view_count)} views · {new Date(video.published_at).toLocaleDateString()}</span>
                      </div>

                      <div className="mt-auto pt-3 border-t border-[var(--line)]/50 flex items-center justify-between">
                        <div className="overflow-hidden pr-2">
                          <a
                            href={`https://youtube.com/channel/${video.channel_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`font-semibold text-xs truncate hover:underline block ${isGiantSlayer ? 'text-amber-400' : 'text-[var(--accent)]'}`}
                          >
                            {video.channel_name}
                          </a>
                          <div className="text-[0.7rem] text-[var(--muted)] font-mono">
                            {formatNumber(video.subscriber_count)} subs
                          </div>
                        </div>

                        <button
                          disabled={isAlreadyAdded || addingId === video.channel_id}
                          onClick={() => handleAdd(video.channel_id)}
                          className={`text-xs px-3 py-1.5 rounded font-semibold transition-all cursor-pointer ${
                            isAlreadyAdded
                              ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-900/30 cursor-not-allowed'
                              : isGiantSlayer
                                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold'
                                : 'bg-[var(--line)] hover:bg-[#2e3e56] text-[var(--ink)]'
                          }`}
                        >
                          {isAlreadyAdded ? '✓ Tracked' : addingId === video.channel_id ? 'Adding...' : '+ Track Competitor'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16 border border-dashed border-[var(--line)] rounded-xl max-w-2xl mx-auto bg-[#0b0f17]/30">
              <Filter className="mx-auto text-[var(--muted)] mb-3 opacity-40" size={32} />
              <h3 className="text-sm font-semibold text-white mb-1">No matching results</h3>
              <p className="text-xs text-[var(--muted)] font-mono max-w-xs mx-auto mb-4">
                No sniped videos match your active filter configuration. Relax your criteria or toggle off Giant Slayers focus.
              </p>
              <button
                onClick={handleResetFilters}
                className="bg-[var(--accent)] hover:opacity-90 text-white font-semibold text-xs px-4 py-2 rounded-lg transition-all cursor-pointer"
              >
                Reset All Filters
              </button>
            </div>
          )}
        </>
      )}

      {!loading && results.length === 0 && !error && (
        <div className="text-center py-20 border border-dashed border-[var(--line)] rounded-xl max-w-2xl mx-auto bg-[#0b0f17]/20">
          <TrendingUp className="mx-auto text-[var(--muted)] mb-3 opacity-40" size={36} />
          <p className="text-sm text-[var(--muted)] font-mono mb-2">No research results loaded yet.</p>
          <button
            onClick={handleRefresh}
            className="text-xs text-indigo-400 hover:underline cursor-pointer"
          >
            Click here to trigger search for WWII documentaries
          </button>
        </div>
      )}
    </div>
  );
}
