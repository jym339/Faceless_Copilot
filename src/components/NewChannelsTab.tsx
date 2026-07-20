import { useEffect, useState } from 'react';
import { Calendar, Users, Award, ExternalLink, TrendingUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface NewChannel {
  id: string;
  title: string;
  handle: string;
  avatar_url: string;
  subscriber_count: number;
  created_at: string;
  avg_views_longform: number;
  avg_views_shorts: number;
  best_video_title: string | null;
  best_video_views: number | null;
  best_video_outlier: number | null;
}

export default function NewChannelsTab() {
  const [channels, setChannels] = useState<NewChannel[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNewChannels = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('oauth_token');
      const res = await fetch('/api/new_channels', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setChannels(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNewChannels();
  }, []);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-[#05070a]">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Channels Discovery Feed</h1>
          <p className="text-[0.8rem] text-[var(--muted)] mt-1">
            Spot newly created competitors early before they scale. Reverse-engineer their early viral video outliers!
          </p>
        </div>
        <button
          onClick={fetchNewChannels}
          className="bg-[var(--card-bg)] border border-[var(--line)] text-[var(--muted)] text-xs px-3 py-1.5 rounded font-semibold hover:bg-[#1e293b]"
        >
          Refresh Feed
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-[var(--line)] border-t-[var(--accent)] rounded-full animate-spin"></div>
        </div>
      ) : channels.length > 0 ? (
        <div className="space-y-4 max-w-4xl">
          {channels.map((ch) => {
            const ageString = ch.created_at ? formatDistanceToNow(new Date(ch.created_at), { addSuffix: true }) : 'unknown age';
            
            return (
              <div key={ch.id} className="bg-[var(--card-bg)] border border-[var(--line)] rounded-xl p-4 md:p-5 flex flex-col sm:flex-row gap-4 sm:gap-5 items-start">
                <img 
                  src={ch.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=60'} 
                  alt="" 
                  className="w-12 h-12 rounded-full bg-slate-800 shrink-0 object-cover border border-[var(--line)] self-start"
                />

                <div className="flex-1 min-w-0 w-full">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-3 w-full">
                    <div>
                      <h3 className="font-bold text-base text-[var(--ink)] flex items-center gap-2 flex-wrap">
                        {ch.title}
                        {ch.handle && <span className="text-xs text-[var(--muted)] font-normal">{ch.handle}</span>}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[var(--muted)] mt-1.5 font-mono">
                        <span className="flex items-center gap-1">
                          <Calendar size={13} className="text-[var(--accent)]" /> 
                          Created: {ageString}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users size={13} className="text-[var(--accent)]" /> 
                          {formatNumber(ch.subscriber_count)} subs
                        </span>
                      </div>
                    </div>
                    
                    <a 
                      href={`https://youtube.com/channel/${ch.id}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-[var(--muted)] hover:text-[var(--accent)] flex items-center gap-1 border border-[var(--line)] px-2.5 py-1 rounded hover:bg-slate-800 self-start shrink-0"
                    >
                      Channel <ExternalLink size={12} />
                    </a>
                  </div>

                  {ch.best_video_title ? (
                    <div className="mt-4 p-3.5 bg-slate-950/40 rounded-lg border border-[var(--line)]/50">
                      <div className="text-[0.7rem] uppercase tracking-wider font-bold text-[var(--accent)] mb-1 flex items-center gap-1.5">
                        <Award size={12} /> Top Outlier Upload
                      </div>
                      <div className="font-semibold text-sm truncate text-[var(--ink)]" title={ch.best_video_title}>
                        {ch.best_video_title}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-[var(--muted)] mt-1 font-mono">
                        <span>views: <strong className="text-[var(--ink)]">{formatNumber(ch.best_video_views || 0)}</strong></span>
                        {ch.best_video_outlier && (
                          <span className="bg-[var(--accent)]/15 border border-[var(--accent)]/30 text-[var(--accent)] px-1.5 py-0.5 rounded text-[0.7rem] font-bold">
                            {ch.best_video_outlier.toFixed(1)}x baseline
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 text-xs text-[var(--muted)] font-mono">
                      No video uploads fetched yet. Add channel to watchlist to crawl its recent posts.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-20 border border-dashed border-[var(--line)] rounded-xl max-w-2xl">
          <TrendingUp className="mx-auto text-[var(--muted)] mb-3 opacity-40" size={36} />
          <p className="text-sm text-[var(--muted)] font-mono">No competitor channels tracked in system database yet. Add competitor handles or URLs to track them.</p>
        </div>
      )}
    </div>
  );
}
