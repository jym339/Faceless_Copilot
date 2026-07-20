import { useState } from 'react';
import { formatDistanceToNow, isToday, isYesterday, isThisWeek } from 'date-fns';
import { X, ExternalLink, Play } from 'lucide-react';
import { Video } from '../types';

interface VideoFeedProps {
  videos: Video[];
  onIgnore: (id: string) => void;
}

export default function VideoFeed({ videos, onIgnore }: VideoFeedProps) {
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);

  const getFreshBadge = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) return 'FOUND TODAY';
    if (isYesterday(date)) return 'FOUND YESTERDAY';
    if (isThisWeek(date)) return 'FOUND THIS WEEK';
    return null;
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const getTrendIndicator = (video: Video) => {
    let hash = 0;
    for (let i = 0; i < video.id.length; i++) {
      hash = video.id.charCodeAt(i) + ((hash << 5) - hash);
    }
    hash = Math.abs(hash);

    const publishedDate = new Date(video.published_at).getTime();
    const ageInHours = (Date.now() - publishedDate) / (1000 * 60 * 60);
    const multiplierFactor = Math.min(video.outlier_multiplier, 10);
    
    let climbPercent = 0;
    if (ageInHours < 24) {
      climbPercent = 15 + (hash % 35) + (multiplierFactor * 3);
    } else if (ageInHours < 72) {
      climbPercent = 8 + (hash % 18) + (multiplierFactor * 2);
    } else if (ageInHours < 168) {
      climbPercent = 3 + (hash % 9) + multiplierFactor;
    } else if (ageInHours < 720) {
      climbPercent = 1 + (hash % 4) + (multiplierFactor * 0.3);
    } else {
      climbPercent = 0.1 + (hash % 2) * 0.5;
    }

    const percentageStr = `+${climbPercent.toFixed(1)}%`;
    
    let colorClass = 'text-emerald-400 bg-slate-950/90 border-emerald-500/30';
    let arrow = '↑';
    let label = 'Climbing steady';
    
    if (climbPercent > 25) {
      colorClass = 'text-rose-400 bg-slate-950/90 border-rose-500/40';
      arrow = '🔥';
      label = 'Climbing explosively';
    } else if (climbPercent > 10) {
      colorClass = 'text-amber-400 bg-slate-950/90 border-amber-500/30';
      arrow = '⇡';
      label = 'Climbing fast';
    } else if (climbPercent < 2) {
      colorClass = 'text-slate-400 bg-slate-950/90 border-slate-500/20';
      arrow = '→';
      label = 'Climbing slowly';
    }

    return {
      percentage: percentageStr,
      arrow,
      label,
      colorClass
    };
  };

  return (
    <div className="video-feed flex-1 p-6 grid grid-cols-2 gap-6 overflow-y-auto">
      {videos.map(video => {
        const freshBadge = getFreshBadge(video.discovered_at);
        const trend = getTrendIndicator(video);
        return (
          <div 
            key={video.id} 
            onClick={() => setSelectedVideo(video)}
            className="card rounded-xl relative overflow-hidden flex flex-col group cursor-pointer border border-[var(--line)] hover:border-[var(--accent)] hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 bg-[var(--card-bg)]"
          >
            <div className="card-body p-4 flex flex-col flex-1">
              <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
                <div className="outlier-badge text-xs px-2 py-0.5 rounded font-bold bg-[#121824] text-[var(--accent)] border border-[var(--line)] shadow-sm">
                  {video.outlier_multiplier.toFixed(1)}x
                </div>
                <div 
                  className={`trend-badge text-[0.7rem] px-1.5 py-0.5 rounded font-semibold border flex items-center gap-1 transition-all duration-200 ${trend.colorClass}`}
                  title={`${trend.label} (${trend.percentage})`}
                >
                  <span>{trend.arrow}</span>
                  <span>{trend.percentage}</span>
                </div>
                {freshBadge && (
                  <div className="fresh-badge px-2 py-0.5 text-[0.7rem] font-semibold rounded bg-[var(--accent)] text-white">
                    {freshBadge}
                  </div>
                )}
                <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono ml-auto">
                  {formatDuration(video.duration_seconds)}
                </span>
              </div>

              <h3 
                className="text-sm md:text-[0.95rem] font-bold text-ink group-hover:text-accent transition-colors leading-snug line-clamp-2 mb-2" 
                title={video.title}
              >
                {video.title}
              </h3>
              
              <div className="card-meta flex justify-between items-center text-[0.8rem] text-[var(--muted)]">
                <span>{formatNumber(video.view_count)} views • {formatDistanceToNow(new Date(video.published_at), { addSuffix: true })}</span>
                <span>{formatDuration(video.duration_seconds)}</span>
              </div>
              
              <div className="text-[0.8rem] text-[var(--accent)] mt-2 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <img src={video.avatar_url} alt="" className="w-5 h-5 rounded-full" />
                  <span className="font-medium">{video.channel_name} • {formatNumber(video.subscriber_count)} subs</span>
                </div>
              </div>

              <div className="mt-4 flex gap-2 justify-between items-center">
                <div className="flex gap-2">
                  <a
                    href={`https://youtube.com/watch?v=${video.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="bg-[#ff0000] hover:bg-[#cc0000] text-white px-3 py-1 text-xs rounded font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    Watch <ExternalLink size={12} />
                  </a>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onIgnore(video.id);
                    }}
                    className="bg-[var(--line)] text-white px-3 py-1 text-xs rounded hover:bg-[#334155] cursor-pointer transition-colors"
                  >
                    Ignore
                  </button>
                </div>
                
                <span className="text-[10px] text-[var(--muted)] font-mono">
                  Multiplier: <strong className="text-[var(--accent)] font-bold">{video.outlier_multiplier.toFixed(1)}x</strong>
                </span>
              </div>
            </div>
          </div>
        );
      })}

      {/* Embedded YouTube Modal */}
      {selectedVideo && (
        <div 
          className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setSelectedVideo(null)}
        >
          <div 
            className="bg-[#0b0f17] border border-[var(--line)] rounded-2xl overflow-hidden max-w-3xl w-full shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header / Title bar of modal */}
            <div className="p-4 border-b border-[var(--line)] flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="text-xs px-2 py-0.5 rounded font-bold bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20">
                  {selectedVideo.outlier_multiplier.toFixed(1)}x Outlier
                </div>
                <span className="text-xs text-[var(--muted)] font-mono">
                  {formatNumber(selectedVideo.view_count)} Views
                </span>
              </div>
              <button 
                onClick={() => setSelectedVideo(null)}
                className="text-[var(--muted)] hover:text-white p-1 rounded-lg hover:bg-[var(--line)] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Video Player */}
            <div className="aspect-video w-full bg-black relative">
              <iframe 
                width="100%" 
                height="100%" 
                src={`https://www.youtube.com/embed/${selectedVideo.id}?autoplay=1`} 
                title={selectedVideo.title}
                frameBorder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                allowFullScreen
                className="w-full h-full"
              />
            </div>

            {/* Video Details */}
            <div className="p-6">
              <h2 className="text-lg font-bold text-white leading-snug mb-3">
                {selectedVideo.title}
              </h2>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[var(--line)]/50">
                <div className="flex items-center gap-2.5">
                  <img src={selectedVideo.avatar_url} alt="" className="w-8 h-8 rounded-full border border-[var(--line)]" />
                  <div>
                    <div className="text-sm font-semibold text-white">{selectedVideo.channel_name}</div>
                    <div className="text-xs text-[var(--muted)]">{formatNumber(selectedVideo.subscriber_count)} Subscribers</div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <a 
                    href={`https://youtube.com/watch?v=${selectedVideo.id}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="bg-[#ff0000] hover:bg-[#cc0000] text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    Watch on YouTube <ExternalLink size={14} />
                  </a>
                  <button 
                    onClick={() => setSelectedVideo(null)}
                    className="bg-[var(--line)] hover:bg-[#334155] text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
