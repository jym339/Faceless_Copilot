import React, { useState, useEffect } from 'react';
import { Award, Sparkles, TrendingUp, ShieldAlert, CheckSquare, Loader2, ArrowRight, ShieldCheck, Zap } from 'lucide-react';

interface SWOT {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

interface RoadmapItem {
  phase: string;
  action: string;
}

interface VerdictCache {
  positioning: string;
  gap_analysis: string;
  swot: SWOT;
  roadmap: RoadmapItem[];
}

interface Channel {
  id: string;
  title: string;
  avatar_url: string;
  subscriber_count: number;
}

export default function VerdictTab() {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [channelSet, setChannelSet] = useState(false);
  const [myChannel, setMyChannel] = useState<Channel | null>(null);
  const [verdict, setVerdict] = useState<VerdictCache | null>(null);
  const [timestamp, setTimestamp] = useState<string | null>(null);
  const [error, setError] = useState('');

  const fetchVerdict = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('oauth_token');
      const res = await fetch('/api/verdict', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const data = await res.json();
      
      setChannelSet(data.set);
      if (data.set) {
        setMyChannel(data.myChannel);
        if (data.hasCache) {
          setVerdict(data.cache);
          setTimestamp(data.timestamp);
        } else {
          setVerdict(null);
          setTimestamp(null);
        }
      }
    } catch (err) {
      setError('Failed to fetch audit verdict details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVerdict();
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    try {
      const token = localStorage.getItem('oauth_token');
      const res = await fetch('/api/verdict/generate', {
        method: 'POST',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });

      const data = await res.json();
      if (res.ok) {
        setVerdict(data.verdict);
        setTimestamp(new Date().toISOString());
      } else {
        setError(data.error || 'Failed to generate diagnostic verdict.');
      }
    } catch (err) {
      setError('Network error during analysis. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-32 bg-[#05070a] gap-3">
        <Loader2 className="animate-spin text-[var(--accent)]" size={32} />
        <span className="text-xs text-[var(--muted)]">Consulting local databases and performance metrics...</span>
      </div>
    );
  }

  if (!channelSet) {
    return (
      <div className="flex-1 p-6 flex flex-col items-center justify-center text-center bg-[#05070a] max-w-xl mx-auto my-12">
        <ShieldAlert className="text-red-500 mb-4" size={48} />
        <h2 className="text-lg font-bold text-[var(--ink)]">Link "My Channel" to Unlock Verdicts</h2>
        <p className="text-xs text-[var(--muted)] mt-2 mb-6 leading-relaxed">
          The James Verdict scans your channel metrics against competitors and niches to diagnose content bottlenecks. Please set up your channel handle under the <strong>My Channel</strong> tab first!
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-[#05070a]">
      {/* Header Info */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--line)] pb-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <Award className="text-[var(--accent)]" size={24} />
            James Verdict
          </h1>
          <p className="text-[0.8rem] text-[var(--muted)] mt-1">
            Personalized, high-conviction audit scanning your statistics against your monitored competitor watchlists.
          </p>
        </div>

        <button
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white font-semibold rounded-md text-xs cursor-pointer transition-all shadow-md disabled:opacity-50 shrink-0 self-start md:self-center"
        >
          {generating ? (
            <>
              <Loader2 className="animate-spin" size={14} />
              <span>Scanning Channel Performance...</span>
            </>
          ) : (
            <>
              <Zap size={14} />
              <span>{verdict ? 'Regenerate Verdict' : 'Run Account Verdict Scan'}</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-950/40 border border-red-900/60 text-red-300 text-xs rounded-md">
          <span>{error}</span>
        </div>
      )}

      {generating ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 bg-[#0b0f17] border border-[var(--line)] rounded-lg p-8">
          <Loader2 className="animate-spin text-red-500" size={40} />
          <div className="text-center">
            <h3 className="text-sm font-bold text-[var(--ink)]">Analyzing Audience Overlaps & Outlier Multipliers</h3>
            <p className="text-[11px] text-[var(--muted)] mt-1 max-w-[380px] mx-auto leading-normal">
              Our growth engine is mapping your content patterns against competitor outlier triggers and generating SWOT benchmarks with Gemini.
            </p>
          </div>
          <div className="flex flex-col gap-1.5 w-full max-w-xs mt-2 text-[10px] font-mono text-[var(--muted)]">
            <div className="flex justify-between border-b border-[var(--line)]/50 pb-1">
              <span>Channel:</span> <span className="text-[var(--ink)] font-bold">{myChannel?.title}</span>
            </div>
            <div className="flex justify-between border-b border-[var(--line)]/50 pb-1">
              <span>Subscribers:</span> <span className="text-[var(--ink)] font-bold">{formatNumber(myChannel?.subscriber_count || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span>Auditor Mode:</span> <span className="text-red-400 font-bold">EXECUTIVE COACH</span>
            </div>
          </div>
        </div>
      ) : !verdict ? (
        <div className="border border-dashed border-[var(--line)] rounded-lg p-10 text-center max-w-xl mx-auto my-6 bg-[#0b0f17]/40">
          <ShieldCheck className="text-[var(--muted)] mx-auto mb-4" size={44} />
          <h2 className="text-sm font-bold text-[var(--ink)]">Account Strategic Verdict Ready</h2>
          <p className="text-xs text-[var(--muted)] mt-2 mb-6 max-w-[340px] mx-auto leading-relaxed">
            Ready to audit <strong>{myChannel?.title}</strong>? Click below to run the complete diagnostic report on content positioning, gap studies, and a 30-day growth roadmap.
          </p>
          <button
            onClick={handleGenerate}
            className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded cursor-pointer transition-all flex items-center gap-2 mx-auto"
          >
            <Zap size={14} />
            <span>Generate Strategic Audit Verdict</span>
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Quick Stats Banner */}
          <div className="p-4 bg-gradient-to-r from-red-950/20 via-slate-900/30 to-[#0b0f17] border border-[var(--line)] rounded-lg flex justify-between items-center flex-wrap gap-2 text-xs">
            <span className="text-[var(--muted)] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
              Audit Active for <strong className="text-[var(--ink)]">{myChannel?.title}</strong>
            </span>
            {timestamp && (
              <span className="text-[10px] text-gray-500 font-mono">
                Verdict Date: {new Date(timestamp).toLocaleString()}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left/Main Column: Positioning and Gaps */}
            <div className="lg:col-span-2 space-y-6">
              {/* Strategic positioning */}
              <div className="bg-[#0b0f17] border border-[var(--line)] rounded-lg p-5">
                <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-red-400 mb-3 flex items-center gap-2">
                  <TrendingUp size={14} /> Strategic Positioning Audit
                </h3>
                <p className="text-xs text-[var(--muted)] leading-relaxed whitespace-pre-line">
                  {verdict.positioning}
                </p>
              </div>

              {/* Competitor Gap Analysis */}
              <div className="bg-[#0b0f17] border border-[var(--line)] rounded-lg p-5">
                <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-amber-400 mb-3 flex items-center gap-2">
                  <Sparkles size={14} /> Competitor Gap & Outlier Analysis
                </h3>
                <p className="text-xs text-[var(--muted)] leading-relaxed whitespace-pre-line">
                  {verdict.gap_analysis}
                </p>
              </div>

              {/* 30-Day Growth Verdict Roadmap */}
              <div className="bg-[#0b0f17] border border-[var(--line)] rounded-lg p-5">
                <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-cyan-400 mb-4 flex items-center gap-2">
                  <CheckSquare size={14} /> The 30-Day Growth Verdict (High-Conviction Action-Plan)
                </h3>
                <div className="space-y-4">
                  {verdict.roadmap.map((phase, i) => (
                    <div key={i} className="flex gap-4 items-start p-3 bg-[#121824] rounded-lg border border-[var(--line)]/50">
                      <div className="w-8 h-8 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-900 flex items-center justify-center font-bold font-mono text-xs shrink-0 mt-0.5">
                        {i + 1}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[var(--ink)]">{phase.phase}</h4>
                        <p className="text-[11px] text-[var(--muted)] mt-1 leading-normal">{phase.action}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: SWOT */}
            <div className="lg:col-span-1 bg-[#0b0f17] border border-[var(--line)] rounded-lg p-5 self-start">
              <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-[var(--ink)] mb-4 flex items-center gap-2">
                 SWOT Matrix Breakdown
              </h3>

              <div className="space-y-5">
                {/* Strengths */}
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-extrabold mb-1.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    Strengths
                  </div>
                  <ul className="space-y-1 pl-3 list-disc text-[11px] text-[var(--muted)] leading-relaxed">
                    {verdict.swot.strengths.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>

                {/* Weaknesses */}
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-red-400 font-extrabold mb-1.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                    Weaknesses
                  </div>
                  <ul className="space-y-1 pl-3 list-disc text-[11px] text-[var(--muted)] leading-relaxed">
                    {verdict.swot.weaknesses.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>

                {/* Opportunities */}
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-extrabold mb-1.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                    Opportunities
                  </div>
                  <ul className="space-y-1 pl-3 list-disc text-[11px] text-[var(--muted)] leading-relaxed">
                    {verdict.swot.opportunities.map((o, i) => (
                      <li key={i}>{o}</li>
                    ))}
                  </ul>
                </div>

                {/* Threats */}
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-extrabold mb-1.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                    Threats
                  </div>
                  <ul className="space-y-1 pl-3 list-disc text-[11px] text-[var(--muted)] leading-relaxed">
                    {verdict.swot.threats.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
