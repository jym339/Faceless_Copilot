import { useState, useEffect } from 'react';
import { 
  Image as ImageIcon, ExternalLink, Sparkles, Zap, Eye, 
  Layers, CheckSquare, Target, Lightbulb, BookOpen, ChevronRight 
} from 'lucide-react';
import { Video } from '../types';

export default function ThumbnailsTab() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterFormat, setFilterFormat] = useState<'all' | 'long' | 'short'>('all');
  const [activeSubTab, setActiveSubTab] = useState<'board' | 'blueprint'>('board');

  const fetchOutliers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('oauth_token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(`/api/videos?format=${filterFormat}&window=90d`, { headers });
      const data = await res.json();
      if (Array.isArray(data)) {
        const outlierVids = data.filter((v: Video) => v.outlier_multiplier >= 1.2);
        setVideos(outlierVids);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOutliers();
  }, [filterFormat]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-[#05070a]">
      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--line)] pb-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <ImageIcon className="text-[var(--accent)]" size={24} />
            Thumbnail Packaging Studio
          </h1>
          <p className="text-[0.8rem] text-[var(--muted)] mt-1">
            Analyze, reverse-engineer, and craft click-compelling layouts that dominate the algorithm.
          </p>
        </div>

        {/* Sub-tabs switch */}
        <div className="flex bg-[#0b0f17] border border-[var(--line)] p-1 rounded-lg gap-1 shrink-0">
          <button
            onClick={() => setActiveSubTab('board')}
            className={`px-3 py-1.5 rounded-md text-[10px] font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
              activeSubTab === 'board' ? 'bg-[var(--accent)] text-white font-black' : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            <ImageIcon size={12} />
            Inspiration Board
          </button>
          <button
            onClick={() => setActiveSubTab('blueprint')}
            className={`px-3 py-1.5 rounded-md text-[10px] font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
              activeSubTab === 'blueprint' ? 'bg-[var(--accent)] text-white font-black' : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            <Zap size={12} />
            Low-Sub Click Blueprint
          </button>
        </div>
      </div>

      {activeSubTab === 'board' ? (
        <>
          {/* Filters Bar */}
          <div className="mb-6 flex flex-col sm:flex-row justify-between items-center bg-[#0b0f17] p-3 border border-[var(--line)] rounded-xl gap-3">
            <span className="text-[10px] font-bold font-mono text-[var(--muted)] uppercase tracking-wider">
              Niche Outlier High-CTR Assets ({videos.length} loaded)
            </span>
            <div className="flex gap-1.5 bg-[#121824] p-1 rounded-lg border border-[var(--line)]/50">
              <button
                onClick={() => setFilterFormat('all')}
                className={`px-2.5 py-1 text-[10px] font-bold rounded cursor-pointer transition-all ${
                  filterFormat === 'all' ? 'bg-[var(--accent)] text-white' : 'text-[var(--muted)] hover:text-white'
                }`}
              >
                All Formats
              </button>
              <button
                onClick={() => setFilterFormat('long')}
                className={`px-2.5 py-1 text-[10px] font-bold rounded cursor-pointer transition-all ${
                  filterFormat === 'long' ? 'bg-[var(--accent)] text-white' : 'text-[var(--muted)] hover:text-white'
                }`}
              >
                Long-form
              </button>
              <button
                onClick={() => setFilterFormat('short')}
                className={`px-2.5 py-1 text-[10px] font-bold rounded cursor-pointer transition-all ${
                  filterFormat === 'short' ? 'bg-[var(--accent)] text-white' : 'text-[var(--muted)] hover:text-white'
                }`}
              >
                Shorts
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
              <div className="w-8 h-8 border-4 border-[var(--line)] border-t-[var(--accent)] rounded-full animate-spin"></div>
              <span className="text-xs text-[var(--muted)] font-mono">Loading outlier imagery...</span>
            </div>
          ) : videos.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
              {videos.map((v) => {
                const isCrazyOutlier = v.outlier_multiplier >= 4.0;
                return (
                  <div 
                    key={v.id} 
                    className="group relative bg-[#0b0f17] border border-[var(--line)] rounded-2xl overflow-hidden flex flex-col justify-between transition-all hover:border-[var(--accent)]/60 shadow-lg"
                  >
                    {/* Info */}
                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className={`text-[10px] font-extrabold px-2 py-0.5 rounded flex items-center gap-1 ${
                          isCrazyOutlier 
                            ? 'bg-amber-500 text-slate-950 font-black' 
                            : 'bg-[#121824] border border-[var(--line)] text-[var(--accent)]'
                        }`}>
                          {v.outlier_multiplier.toFixed(1)}x {isCrazyOutlier ? <Sparkles size={11} /> : 'Multiplier'}
                        </div>
                        <div className="text-[10px] font-mono text-[var(--muted)]">
                          {formatNumber(v.view_count)} views
                        </div>
                      </div>

                      <div className="text-sm md:text-base font-bold text-white line-clamp-3 leading-snug mb-4 group-hover:text-[var(--accent)] transition-colors duration-200" title={v.title}>
                        {v.title}
                      </div>

                      <div className="pt-3 border-t border-[var(--line)]/50 flex justify-between items-center text-[10px] text-[var(--muted)] font-mono">
                        <span className="truncate max-w-[70%] text-slate-400 font-bold">{v.channel_name}</span>
                        <a 
                          href={`https://youtube.com/watch?v=${v.id}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="bg-[#121824] hover:bg-[#1e293b] border border-[var(--line)] px-2.5 py-1 rounded text-[9px] text-[var(--accent)] font-bold flex items-center gap-1 transition-all"
                        >
                          Watch <ExternalLink size={10} />
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-20 border border-dashed border-[var(--line)] rounded-2xl max-w-2xl mx-auto bg-[#0b0f17]/20">
              <ImageIcon className="mx-auto text-[var(--muted)] mb-3 opacity-40" size={36} />
              <p className="text-sm text-[var(--muted)] font-mono max-w-sm mx-auto leading-relaxed">
                No outlier thumbnail designs recorded yet. Add channels to watchlist and click "Fetch Latest Data" to collect outlier statistics.
              </p>
            </div>
          )}
        </>
      ) : (
        /* Dynamic Click-Trigger Blueprint Panel */
        <div className="space-y-6 animate-fade-in">
          {/* Overview Banner */}
          <div className="p-5 bg-gradient-to-r from-indigo-950/20 via-[#0b0f17] to-[#05070a] border border-indigo-500/20 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[9px] font-bold font-mono text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 inline-block mb-1">
                The Low-Subscriber Click Theory
              </span>
              <h2 className="text-base font-bold text-white">Reverse-Engineering Best-In-Class Packaging</h2>
              <p className="text-xs text-[var(--muted)] max-w-2xl leading-relaxed">
                Smaller channels do not enjoy loyal click-through rates. To win clicks against 1M+ subscriber creators, their packaging must leverage intense **Pattern Disruption**, **Semantic Conflict**, and pristine **Visual Clarity**. Here is the exact blueprint.
              </p>
            </div>
            <div className="shrink-0 flex items-center gap-1 text-[11px] font-mono text-amber-500 font-bold bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl">
              <Target size={13} className="animate-pulse" />
              <span>Goal: &gt;12.5% CTR</span>
            </div>
          </div>

          {/* Bento Breakdown Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* 1. Visual Isolation */}
            <div className="bg-[#0b0f17] border border-[var(--line)] rounded-2xl p-5 hover:border-slate-800 transition-colors flex flex-col justify-between">
              <div>
                <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-3.5">
                  <Layers size={16} />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono mb-2">1. The Visual Isolation Rule</h3>
                <p className="text-xs text-[var(--muted)] leading-relaxed">
                  Avoid chaotic, overcrowded thumbnails. Smaller channels trigger clicks when the viewer instantly understands the premise in **under 300 milliseconds**. 
                </p>
                <ul className="mt-3.5 space-y-2 text-[10px] text-slate-400 font-mono">
                  <li className="flex items-start gap-1.5">
                    <span className="text-emerald-500 font-black">•</span>
                    <span>Single high-contrast hero object on a clean, darkened background.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-emerald-500 font-black">•</span>
                    <span>3D depth cue: separate subject with heavy shadow overlay.</span>
                  </li>
                </ul>
              </div>
              <div className="mt-4 pt-3 border-t border-[var(--line)]/50 text-[9px] text-[var(--accent)] font-mono font-bold">
                PRO TIP: Darken ambient corners to isolate the center topic.
              </div>
            </div>

            {/* 2. Semantic Conflict */}
            <div className="bg-[#0b0f17] border border-[var(--line)] rounded-2xl p-5 hover:border-slate-800 transition-colors flex flex-col justify-between">
              <div>
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mb-3.5">
                  <Lightbulb size={16} />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono mb-2">2. Cognitive Dissonance</h3>
                <p className="text-xs text-[var(--muted)] leading-relaxed">
                  Put two elements next to each other that **do not logically belong together**. This forces the brain to halt its scrolling pattern to decode the contradiction.
                </p>
                <ul className="mt-3.5 space-y-2 text-[10px] text-slate-400 font-mono">
                  <li className="flex items-start gap-1.5">
                    <span className="text-emerald-500 font-black">•</span>
                    <span>e.g., A brand new private jet parked in an ancient forest.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-emerald-500 font-black">•</span>
                    <span>e.g., A flawless high-tech device labeled with a red marker "TRASH".</span>
                  </li>
                </ul>
              </div>
              <div className="mt-4 pt-3 border-t border-[var(--line)]/50 text-[9px] text-[var(--accent)] font-mono font-bold">
                PRO TIP: Build curiosity loops instead of spoiling the video layout.
              </div>
            </div>

            {/* 3. The 3-Word Loop Limit */}
            <div className="bg-[#0b0f17] border border-[var(--line)] rounded-2xl p-5 hover:border-slate-800 transition-colors flex flex-col justify-between">
              <div>
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-3.5">
                  <BookOpen size={16} />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono mb-2">3. The 1-to-3 Word Limit</h3>
                <p className="text-xs text-[var(--muted)] leading-relaxed">
                  Never duplicate the exact title on the thumbnail image. Thumbnail text must act as a psychological **curiosity multiplier**, limited strictly to three words.
                </p>
                <ul className="mt-3.5 space-y-2 text-[10px] text-slate-400 font-mono">
                  <li className="flex items-start gap-1.5">
                    <span className="text-emerald-500 font-black">•</span>
                    <span><strong>BAD:</strong> "How Pilots Survive Engine Crashes" (redundant)</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-emerald-500 font-black">•</span>
                    <span><strong>BEST:</strong> "IT'S LOCKED", "THEY LIED", "100% FAULT"</span>
                  </li>
                </ul>
              </div>
              <div className="mt-4 pt-3 border-t border-[var(--line)]/50 text-[9px] text-[var(--accent)] font-mono font-bold">
                PRO TIP: Use bold yellow/white combos with deep drop shadows.
              </div>
            </div>
          </div>

          {/* Detailed Reverse Engineering Case Study */}
          <div className="bg-[#0b0f17] border border-[var(--line)] rounded-2xl p-6">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Eye size={15} className="text-[var(--accent)]" />
              Algorithmic Click Drivers: Small Channel vs Large Channel Dynamics
            </h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs text-[var(--muted)] leading-relaxed">
              <div className="space-y-4">
                <div className="p-4 bg-[#121824]/50 border border-[var(--line)]/40 rounded-xl">
                  <h4 className="font-bold text-white mb-1.5 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                    Small Channel Bottlenecks
                  </h4>
                  <p className="text-[11px] leading-relaxed mb-2">
                    No face value. No authority index. If a low-sub channel attempts standard packaging like "vlogging poses" or generic stock landscapes, CTR tanks below 2.5%.
                  </p>
                  <strong className="text-[var(--accent)] font-mono text-[10px] font-bold">
                    REMEDY: Double-down on extreme visual anomalies and high contrast.
                  </strong>
                </div>

                <div className="p-4 bg-[#121824]/50 border border-[var(--line)]/40 rounded-xl">
                  <h4 className="font-bold text-white mb-1.5 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    The Micro-Dissonance Technique
                  </h4>
                  <p className="text-[11px] leading-relaxed">
                    By showing a well-known historical empire's commander using a modern military radio receiver, you establish an instant "How?" trigger in the audience. That friction is highly addictive for CTR.
                  </p>
                </div>
              </div>

              {/* Checklist */}
              <div className="p-5 bg-[#121824]/30 border border-[var(--line)]/50 rounded-xl flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-white font-mono uppercase tracking-wider text-[11px] mb-3 flex items-center gap-1.5">
                    <CheckSquare size={13} className="text-emerald-400" />
                    THE PRE-PUBLISH PACKAGING CHECKLIST
                  </h4>
                  
                  <div className="space-y-3 font-mono text-[10px] text-slate-300">
                    <div className="flex items-start gap-2.5">
                      <input type="checkbox" defaultChecked className="mt-0.5 rounded accent-[var(--accent)]" />
                      <div>
                        <strong className="text-white">Blur & Silhouette Check</strong>
                        <p className="text-[9px] text-[var(--muted)] mt-0.5">Is the core subject clearly recognizable when squinting or blurred at 10% size?</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <input type="checkbox" defaultChecked className="mt-0.5 rounded accent-[var(--accent)]" />
                      <div>
                        <strong className="text-white">Contrast Split & Luminance</strong>
                        <p className="text-[9px] text-[var(--muted)] mt-0.5">Are background values under 20% luminance and subjects above 80%? Avoid flat lighting.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <input type="checkbox" defaultChecked className="mt-0.5 rounded accent-[var(--accent)]" />
                      <div>
                        <strong className="text-white">Open curiosity loop</strong>
                        <p className="text-[9px] text-[var(--muted)] mt-0.5">Does the packaging prompt a question that is left completely unanswered without watching?</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3.5 border-t border-[var(--line)]/40 flex justify-between items-center text-[10px]">
                  <span className="font-bold text-slate-400">Score target:</span>
                  <span className="text-emerald-400 font-extrabold font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/25">10/10 CRITICAL SCALE</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
