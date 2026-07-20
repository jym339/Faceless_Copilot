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

  return (
    <div className="video-feed flex-1 p-6 grid grid-cols-2 gap-6 overflow-y-auto">
      {videos.map(video => {
        const freshBadge = getFreshBadge(video.discovered_at);
        return (
          <div 
            key={video.id} 
            onClick={() => setSelectedVideo(video)}
            className="card rounded-xl relative overflow-hidden flex flex-col group cursor-pointer border border-[var(--line)] hover:border-[var(--accent)] hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 bg-[var(--card-bg)]"
          >
            <div className="thumb w-full aspect-video bg-[#1a1e26] relative overflow-hidden">
              <img 
                src={video.thumbnail_url} 
                alt={video.title} 
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-102" 
                referrerPolicy="no-referrer"
              />
              <div className="outlier-badge absolute top-3 left-3 text-sm px-2 py-1 rounded font-bold bg-slate-950/85 text-[var(--accent)] border border-[var(--line)]">
                {video.outlier_multiplier.toFixed(1)}x
              </div>
              {freshBadge && (
                <div className="fresh-badge absolute bottom-3 right-3 px-2 py-1 text-[0.7rem] font-semibold rounded bg-[var(--accent)] text-white">
                  {freshBadge}
                </div>
              )}
              {/* Play Button Overlay on Hover */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="p-3.5 bg-[var(--accent)] rounded-full text-white shadow-lg transform scale-90 group-hover:scale-100 transition-transform duration-200">
                  <Play size={20} fill="white" />
                </div>
              </div>
            </div>
            
            <div className="card-body p-4 flex flex-col flex-1">
              <div className="card-title text-[0.95rem] font-semibold leading-relaxed h-[2.8rem] line-clamp-2 mb-2 text-[var(--ink)] group-hover:text-[var(--accent)] transition-colors" title={video.title}>
                {video.title}
              </div>
              
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
