import React, { useState, useEffect } from 'react';
import { 
  Lightbulb, Sparkles, Trash2, Loader2, AlertCircle, 
  ChevronDown, ArrowRight, Copy, Check, MessageSquare, Send, X, EyeOff
} from 'lucide-react';

interface Channel {
  id: string;
  title: string;
  handle: string;
  avatar_url: string;
  subscriber_count: number;
}

interface Video {
  id: string;
  channel_id: string;
  title: string;
  thumbnail_url: string;
  published_at: string;
  view_count: number;
  outlier_multiplier: number;
  format: 'long' | 'short';
}

interface IdeasTabProps {
  channels: Channel[];
  videos: Video[];
}

export default function IdeasTab({ channels = [], videos = [] }: IdeasTabProps) {
  // Navigation & filtering states
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [filterWindow, setFilterWindow] = useState<'7d' | '28d' | '90d' | 'all'>('28d');
  const [filterFormat, setFilterFormat] = useState<'all' | 'long' | 'short'>('all');

  // Video angles & hidden cards
  const [videoAngles, setVideoAngles] = useState<Record<string, string[]>>({});
  const [generatingAngles, setGeneratingAngles] = useState<Record<string, boolean>>({});
  const [hiddenVideos, setHiddenVideos] = useState<Record<string, boolean>>({});

  // Right Drawer: Claude AI Script Outline
  const [selectedAngle, setSelectedAngle] = useState<string | null>(null);
  const [selectedOriginalVideo, setSelectedOriginalVideo] = useState<Video | null>(null);
  const [scriptOutline, setScriptOutline] = useState<string | null>(null);
  const [generatingScript, setGeneratingScript] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([]);
  const [copied, setCopied] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);

  // Initialize selected channel
  useEffect(() => {
    if (channels.length > 0 && !selectedChannel) {
      setSelectedChannel(channels[0]);
    }
  }, [channels]);

  // Helper: Format number
  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  // Helper: Extract a clean topic from a video title
  const getCleanTopic = (title: string): string => {
    let t = title.trim();
    
    // Strip emojis and special character symbols
    t = t.replace(/[\u1F600-\u1F64F\u1F300-\u1F5FF\u1F680-\u1F6FF\u2600-\u26FF\u2700-\u27BF\u1F900-\u1F9FF]/g, '');

    // Remove bracketed/parenthesized content
    t = t.replace(/\[[^\]]*\]/g, '').replace(/\([^)]*\)/g, '');

    // Clean common prefixes case-insensitively
    const prefixesToRemove = [
      /^the best\s+/i,
      /^best\s+/i,
      /^homemade\s+/i,
      /^how to make\s+/i,
      /^how to\s+/i,
      /^how i\s+/i,
      /^secret of\s+/i,
      /^ultimate\s+/i,
      /^classic\s+/i,
      /^delicious\s+/i,
      /^traditional\s+/i,
      /^quick\s+/i,
      /^diy\s+/i,
      /^simple\s+/i,
      /^easy\s+/i,
      /^the\s+/i,
    ];
    
    let changed = true;
    while (changed) {
      changed = false;
      for (const regex of prefixesToRemove) {
        if (regex.test(t)) {
          t = t.replace(regex, '');
          changed = true;
        }
      }
    }

    // Split on common dividers: "...", "|", " — ", " – ", " - ", ":", ",", ";"
    const separators = [/\.\.\./, /\|/, /\s*[\u2014\u2013-]\s*/, /:/, /,/, /;/];
    for (const sep of separators) {
      const parts = t.split(sep);
      if (parts.length > 0 && parts[0].trim().length >= 3) {
        t = parts[0];
      }
    }

    // Trim and clean up non-alphanumeric trailing/leading characters except spaces
    t = t.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '').trim();

    // Split into words and truncate if needed
    const words = t.split(/\s+/);
    const stopWords = [
      'nearly', 'almost', 'always', 'every', 'all', 'year', 'round', 
      'in', 'with', 'of', 'on', 'for', 'at', 'by', 'from', 'about', 'to', 'using', 'without',
      'you', 'your', 'my', 'their', 'our', 'he', 'she', 'it', 'they',
      'will', 'would', 'could', 'should', 'can', 'may', 'might', 'must',
      'the', 'a', 'an', 'this', 'that', 'these', 'those',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
      'how', 'why', 'what', 'who', 'where', 'when'
    ];

    const stopIndex = words.findIndex((w, idx) => idx > 0 && stopWords.includes(w.toLowerCase()));
    if (stopIndex !== -1 && stopIndex <= 4) {
      t = words.slice(0, stopIndex).join(' ');
    } else if (words.length > 4) {
      t = words.slice(0, 3).join(' ');
    }

    if (t.length < 3) {
      t = title.slice(0, 30).trim();
    }

    // Capitalize first letter of each word to look polished
    return t.split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Helper: Get smart initial titles based on keywords (for zero-latency page loads)
  const getSmartInitialAngles = (title: string, channelName: string) => {
    const cleanName = channelName || 'History';
    const lower = title.toLowerCase();
    const topic = getCleanTopic(title);
    
    if (lower.includes('crash') || lower.includes('air') || lower.includes('flight') || lower.includes('aviation')) {
      return [
        `🚨 URGENT: The Critical Cockpit Mistake YouTube Deleted hours before the ${topic} Accident`,
        `How 3 Flight Crews Solved the Same Fatal ${topic} Glitch`,
        `The Secret Black Box Audio Investigators Tried to Hide on ${topic}`,
        `The Terrifying Reason Pilots Fear This ${topic} Route`,
        `What Shocked Aviation Experts About the ${topic} Incident`
      ];
    }
    
    if (lower.includes('war') || lower.includes('battle') || lower.includes('military') || lower.includes('empire') || lower.includes('history')) {
      return [
        `What Shocked Commanders About the ${topic} Tactics`,
        `🚨 URGENT: TOTAL Collapse in Military Strategy during ${topic}`,
        `The Critical Command Mistake That Ended the ${topic}`,
        `How 5 Secret Decisions during the ${topic} Changed the Outcome`,
        `What Shocked Strategists About this Forgotten ${topic} History`
      ];
    }

    const isCooking = cleanName.toLowerCase().includes('cooking') || 
                      cleanName.toLowerCase().includes('food') || 
                      cleanName.toLowerCase().includes('kitchen') || 
                      cleanName.toLowerCase().includes('recipe') || 
                      lower.includes('recipe') || 
                      lower.includes('cook') || 
                      lower.includes('bake') || 
                      lower.includes('food') || 
                      lower.includes('kitchen') || 
                      lower.includes('taste') || 
                      lower.includes('chicken') || 
                      lower.includes('cream') || 
                      lower.includes('dumpling') || 
                      lower.includes('butter');
                      
    if (isCooking) {
      return [
        `How 5 Secret Decisions Saved the Forgotten Recipe for ${topic}`,
        `🚨 URGENT: The Tragic Reality Behind Modern ${topic} That Chefs Hide`,
        `The Critical Cooking Mistake That Ruined the 100-Year Legacy of ${topic}`,
        `What Shocked Culinary Experts About This Traditional ${topic} Technique`,
        `The Unspoken Method That Revived This Historic ${topic} Recipe`
      ];
    }

    // Default versatile angles
    return [
      `How 5 Secret Decisions hours before the crisis changed the outcome of ${topic}`,
      `🚨 URGENT: The Real Danger Behind Modern ${topic} They Aren't Telling You`,
      `The Critical Mistake That Ended the 100-Year Dominance of ${topic}`,
      `What Shocked Industry Experts About This ${topic} Technique`,
      `The Unspoken Method That Saved 50,000 People from ${topic}`
    ];
  };

  // Filter outlier videos of selected channel
  const competitorVideos = videos.filter(v => {
    if (!selectedChannel) return false;
    if (v.channel_id !== selectedChannel.id) return false;
    if (hiddenVideos[v.id]) return false;

    // Window filter
    if (filterWindow !== 'all') {
      let days = 90;
      if (filterWindow === '7d') days = 7;
      if (filterWindow === '28d') days = 28;
      const pubDate = new Date(v.published_at);
      const limitDate = new Date();
      limitDate.setDate(limitDate.getDate() - days);
      if (pubDate < limitDate) return false;
    }

    // Format filter
    if (filterFormat !== 'all' && v.format !== filterFormat) return false;

    return true;
  });

  // Action: Generate dynamic alternative angles using Gemini
  const handleGenerateAngles = async (video: Video) => {
    setGeneratingAngles(prev => ({ ...prev, [video.id]: true }));
    try {
      const token = localStorage.getItem('oauth_token');
      const res = await fetch('/api/ideas/generate-angles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          videoTitle: video.title,
          channelName: selectedChannel?.title
        })
      });

      if (!res.ok) throw new Error('API failed');
      const data = await res.json();
      if (data.angles && Array.isArray(data.angles)) {
        setVideoAngles(prev => ({ ...prev, [video.id]: data.angles }));
      }
    } catch (err) {
      console.error(err);
      // Fallback
      setVideoAngles(prev => ({ 
        ...prev, 
        [video.id]: getSmartInitialAngles(video.title, selectedChannel?.title || '') 
      }));
    } finally {
      setGeneratingAngles(prev => ({ ...prev, [video.id]: false }));
    }
  };

  // Action: Tell Claude (triggers script outline generation)
  const handleTellClaude = async (angle: string, video: Video) => {
    setSelectedAngle(angle);
    setSelectedOriginalVideo(video);
    setGeneratingScript(true);
    setScriptOutline(null);
    setChatHistory([]);
    setCustomPrompt('');

    try {
      const token = localStorage.getItem('oauth_token');
      const res = await fetch('/api/ideas/generate-script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          angle,
          originalTitle: video.title,
          channelName: selectedChannel?.title
        })
      });

      if (!res.ok) throw new Error('Script generation failed');
      const data = await res.json();
      if (data.script) {
        setScriptOutline(data.script);
        setChatHistory([
          { role: 'assistant', text: data.script }
        ]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGeneratingScript(false);
    }
  };

  // Action: Chat simulation with Claude assistant
  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPrompt.trim() || chatLoading) return;

    const userMsg = customPrompt.trim();
    setCustomPrompt('');
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatLoading(true);

    try {
      // Prompt Gemini to act as Claude refining the script outline
      const token = localStorage.getItem('oauth_token');
      const prompt = `You are the Claude AI Video Strategist.
Here is the current video script outline:
${scriptOutline}

The user has asked the following revision: "${userMsg}"

Revise or expand the script outline accordingly. Keep it formatted in clear Markdown. Make it high-conviction and exciting. Return only the revised Markdown output.`;

      const res = await fetch('/api/ideas/generate-script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          angle: `REVISION: ${userMsg}`,
          originalTitle: prompt,
          channelName: selectedChannel?.title
        })
      });

      if (res.ok) {
        const data = await res.json();
        setScriptOutline(data.script);
        setChatHistory(prev => [...prev, { role: 'assistant', text: data.script }]);
      } else {
        throw new Error();
      }
    } catch (err) {
      setChatHistory(prev => [
        ...prev, 
        { role: 'assistant', text: `Sorry, I encountered an issue modifying that section. Here is the original outline:\n\n${scriptOutline}` }
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  // Action: Copy script outline to clipboard
  const handleCopy = () => {
    if (!scriptOutline) return;
    navigator.clipboard.writeText(scriptOutline);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Action: Hide a video card
  const handleHideVideo = (id: string) => {
    setHiddenVideos(prev => ({ ...prev, [id]: true }));
  };

  return (
    <div className="flex-1 flex h-full overflow-hidden bg-[#05070a]">
      {/* Left section: main content feed */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header className="p-6 border-b border-[var(--line)]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Custom polished channel dropdown */}
            <div className="relative z-40">
              <label className="block text-[10px] font-bold text-[var(--muted)] tracking-wider uppercase mb-1.5 font-mono">
                Select target competitor
              </label>
              {selectedChannel ? (
                <div className="relative">
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="flex items-center gap-3 bg-[#0d131f] border border-[var(--line)] hover:border-[var(--accent)] px-4 py-2 rounded-xl text-left min-w-[240px] transition-colors cursor-pointer"
                  >
                    <img 
                      src={selectedChannel.avatar_url} 
                      alt="" 
                      className="w-6 h-6 rounded-full object-cover bg-slate-800 border border-[var(--line)]" 
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-white truncate leading-tight">{selectedChannel.title}</div>
                      <div className="text-[10px] text-[var(--muted)] truncate leading-none mt-0.5">{selectedChannel.handle || '@channel'}</div>
                    </div>
                    <ChevronDown size={14} className="text-[var(--muted)]" />
                  </button>

                  {dropdownOpen && (
                    <div className="absolute left-0 mt-1.5 w-full bg-[#0b0f17] border border-[var(--line)] rounded-xl shadow-2xl max-h-[280px] overflow-y-auto overflow-x-hidden animate-fade-in z-50">
                      {channels.map((ch) => (
                        <button
                          key={ch.id}
                          onClick={() => {
                            setSelectedChannel(ch);
                            setDropdownOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-xs transition-colors hover:bg-[#121824] border-b border-[var(--line)]/50 last:border-b-0 ${
                            selectedChannel.id === ch.id ? 'bg-[#121824]/80' : ''
                          }`}
                        >
                          <img src={ch.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-white truncate">{ch.title}</div>
                            <div className="text-[10px] text-[var(--muted)] truncate">{ch.handle}</div>
                          </div>
                          <span className="text-[9px] text-[var(--accent)] font-mono font-bold bg-[var(--accent)]/10 px-1.5 py-0.5 rounded">
                            {formatNumber(ch.subscriber_count)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-[var(--muted)] font-mono py-2 italic">
                  No competitor channels loaded yet. Please add channels to watchlist first.
                </div>
              )}
            </div>

            {/* Quick Filter buttons */}
            <div className="flex items-center gap-4 mt-auto">
              <div className="flex bg-[#0b0f17] border border-[var(--line)] p-1 rounded-lg gap-1 shrink-0">
                {(['7d', '28d', '90d', 'all'] as const).map((win) => (
                  <button
                    key={win}
                    onClick={() => setFilterWindow(win)}
                    className={`px-3 py-1 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
                      filterWindow === win ? 'bg-[var(--accent)] text-white font-black' : 'text-[var(--muted)] hover:text-[var(--ink)]'
                    }`}
                  >
                    {win === 'all' ? 'All' : win}
                  </button>
                ))}
              </div>

              <div className="flex bg-[#0b0f17] border border-[var(--line)] p-1 rounded-lg gap-1 shrink-0">
                {(['all', 'long', 'short'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => setFilterFormat(fmt)}
                    className={`px-3 py-1 rounded-md text-[10px] font-bold cursor-pointer transition-all capitalize ${
                      filterFormat === fmt ? 'bg-[var(--accent)] text-white font-black' : 'text-[var(--muted)] hover:text-[var(--ink)]'
                    }`}
                  >
                    {fmt === 'long' ? 'Long-form' : fmt === 'short' ? 'Shorts' : 'All Formats'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </header>

        {/* List Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {!selectedChannel ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Lightbulb className="text-[var(--muted)] opacity-30 mb-4 animate-pulse" size={48} />
              <h2 className="text-sm font-semibold text-white">No Competitor Selected</h2>
              <p className="text-xs text-[var(--muted)] mt-1.5 max-w-[320px]">
                Link a competitor channel to your watchlist using the right sidebar first to analyze their outliers.
              </p>
            </div>
          ) : competitorVideos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-[var(--line)] rounded-2xl bg-[#0b0f17]/20">
              <Lightbulb className="text-[var(--muted)] opacity-30 mb-4" size={44} />
              <h2 className="text-sm font-semibold text-white">No Outliers Detected in window</h2>
              <p className="text-xs text-[var(--muted)] mt-1.5 max-w-[340px] leading-relaxed">
                There are no outlier uploads matching the current filters for <strong>{selectedChannel.title}</strong>. Try changing your filters (e.g. to <strong>90d</strong> or <strong>All Formats</strong>).
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {competitorVideos.map((video) => {
                const currentAngles = videoAngles[video.id] || getSmartInitialAngles(video.title, selectedChannel.title);
                const isGenerating = generatingAngles[video.id];

                return (
                  <div 
                    key={video.id}
                    className="flex flex-col bg-[#0b0f17] border border-[var(--line)] rounded-2xl overflow-hidden shadow-lg transition-transform hover:-translate-y-0.5 duration-200"
                  >
                    {/* Card Title Header */}
                    <div className="p-4 border-b border-[var(--line)] bg-[#0d131f]/60">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[11px] font-black uppercase tracking-wider text-amber-500 font-mono flex items-center gap-1.5">
                          <Sparkles size={12} className="text-amber-500 animate-pulse" />
                          5 BENT ANGLES
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="bg-red-500/10 text-red-400 border border-red-500/25 px-1.5 py-0.5 rounded text-[9px] font-bold">
                            {video.outlier_multiplier.toFixed(1)}x Outlier
                          </span>
                        </div>
                      </div>
                      
                      <div className="text-[11px] text-[var(--muted)] font-mono leading-snug line-clamp-2" title={video.title}>
                        <strong className="text-white">Based on:</strong> "{video.title}"
                      </div>
                    </div>

                    {/* Card Body - Alternative Titles List */}
                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div className="space-y-2">
                        {currentAngles.map((angle, idx) => {
                          const isSelected = selectedAngle === angle;
                          return (
                            <div 
                              key={idx}
                              className={`group p-2.5 rounded-xl border transition-all flex items-start gap-2.5 ${
                                isSelected 
                                  ? 'bg-[var(--accent)]/10 border-[var(--accent)] text-white' 
                                  : 'bg-[#121824]/60 hover:bg-[#1a2336]/40 border-[var(--line)]/50 hover:border-slate-700/60'
                              }`}
                            >
                              <span className="w-4 h-4 rounded-full bg-[#1e293b] text-slate-400 flex items-center justify-center font-mono text-[9px] font-bold shrink-0 mt-0.5">
                                {idx + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] text-[var(--ink)] font-semibold leading-relaxed">
                                  {angle.replace('[Tell Claude]', '').trim()}
                                </p>
                                <div className="mt-2 flex justify-end">
                                  <button
                                    onClick={() => handleTellClaude(angle, video)}
                                    className={`px-2.5 py-1 rounded-lg text-[9px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                                      isSelected
                                        ? 'bg-[var(--accent)] text-white scale-95'
                                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-inner'
                                    }`}
                                  >
                                    <MessageSquare size={10} />
                                    <span>Tell Claude</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Card Footer Actions */}
                      <div className="mt-4 pt-4 border-t border-[var(--line)]/40 flex justify-between items-center gap-2">
                        <button
                          onClick={() => handleGenerateAngles(video)}
                          disabled={isGenerating}
                          className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          {isGenerating ? (
                            <>
                              <Loader2 className="animate-spin" size={11} />
                              <span>Regenerating...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles size={11} />
                              <span>Regenerate with AI</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => handleHideVideo(video.id)}
                          className="text-[10px] text-[var(--muted)] hover:text-red-400 font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <EyeOff size={11} />
                          <span>Hide idea</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right section: Claude AI Script Copilot Drawer */}
      {selectedAngle && (
        <aside className="w-[380px] shrink-0 border-l border-[var(--line)] bg-[#070a10] flex flex-col h-full animate-slide-in relative z-50">
          {/* Drawer Header */}
          <div className="p-4 border-b border-[var(--line)] bg-[#0d131f]/60 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                <MessageSquare size={13} />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider leading-none">Script Outline & Copywriter</h3>
                <span className="text-[9px] font-bold text-[var(--muted)] tracking-widest mt-1 inline-block">CLAUDE COPILOT</span>
              </div>
            </div>
            <button
              onClick={() => {
                setSelectedAngle(null);
                setScriptOutline(null);
              }}
              className="text-[var(--muted)] hover:text-white p-1 rounded-lg hover:bg-[#121824] cursor-pointer transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Drawer Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Target Angle info */}
            <div className="p-3 bg-[#0d131f] border border-[var(--line)] rounded-xl">
              <span className="text-[9px] font-mono font-bold text-[var(--muted)] uppercase tracking-wider block mb-1">
                Selected Breakthrough Angle:
              </span>
              <p className="text-xs font-bold text-white leading-relaxed">
                "{selectedAngle.replace('[Tell Claude]', '').trim()}"
              </p>
            </div>

            {generatingScript ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
                <Loader2 className="animate-spin text-indigo-500" size={32} />
                <h4 className="text-xs font-bold text-white">Claude is drafting script blueprint...</h4>
                <p className="text-[10px] text-[var(--muted)] max-w-[240px] leading-relaxed">
                  Analyzing core hook factors and viewer psychology ratios with Gemini Flash.
                </p>
              </div>
            ) : (
              <div className="space-y-4 pb-4">
                {/* Chat logs / Output display */}
                <div className="space-y-4">
                  {chatHistory.map((msg, i) => (
                    <div 
                      key={i} 
                      className={`flex flex-col ${
                        msg.role === 'user' ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div className={`p-3 rounded-xl max-w-[90%] text-xs leading-relaxed whitespace-pre-line ${
                        msg.role === 'user'
                          ? 'bg-indigo-600 text-white rounded-tr-none'
                          : 'bg-[#121824] text-slate-300 border border-[var(--line)]/50 rounded-tl-none font-sans'
                      }`}>
                        {msg.role === 'assistant' ? (
                          <div className="prose prose-invert max-w-none text-xs leading-relaxed space-y-2">
                            {/* Simple render of bullet items and headers inside script output to look gorgeous */}
                            {msg.text.split('\n').map((line, idx) => {
                              if (line.startsWith('###') || line.startsWith('####')) {
                                return (
                                  <h4 key={idx} className="text-xs font-black text-amber-500 uppercase font-mono tracking-wide mt-3 mb-1">
                                    {line.replace(/#/g, '').trim()}
                                  </h4>
                                );
                              }
                              if (line.startsWith('*') || line.startsWith('-')) {
                                return (
                                  <div key={idx} className="pl-2 flex items-start gap-1">
                                    <span className="text-amber-500 shrink-0 font-bold mt-0.5">•</span>
                                    <span>{line.substring(1).trim()}</span>
                                  </div>
                                );
                              }
                              if (line.startsWith('>')) {
                                return (
                                  <blockquote key={idx} className="border-l-2 border-indigo-500 pl-3 py-1 bg-indigo-950/20 text-indigo-200 italic my-2 rounded-r">
                                    {line.substring(1).trim()}
                                  </blockquote>
                                );
                              }
                              return <p key={idx} className="text-slate-300 leading-relaxed">{line}</p>;
                            })}
                          </div>
                        ) : (
                          msg.text
                        )}
                      </div>
                      <span className="text-[8px] text-gray-600 font-mono mt-1 px-1 capitalize">
                        {msg.role === 'user' ? 'You' : 'Claude'}
                      </span>
                    </div>
                  ))}

                  {chatLoading && (
                    <div className="flex items-center gap-2 p-2 bg-[#121824]/40 rounded-xl max-w-[80%] border border-[var(--line)]/40">
                      <Loader2 className="animate-spin text-indigo-500" size={12} />
                      <span className="text-[10px] text-[var(--muted)] font-mono">Claude is writing...</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Drawer Footer Actions & Chat Box */}
          {!generatingScript && scriptOutline && (
            <div className="p-4 border-t border-[var(--line)] bg-[#0b0f17] space-y-3">
              <button
                onClick={handleCopy}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check size={13} />
                    <span>Copied Strategy!</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    <span>Copy Full Strategy</span>
                  </>
                )}
              </button>

              <form onSubmit={handleSendChat} className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="Ask Claude to revise script outline..."
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  className="flex-1 bg-[#121824] border border-[var(--line)] text-white text-xs px-3 py-2 rounded-lg outline-none focus:border-indigo-500 transition-colors"
                />
                <button
                  type="submit"
                  disabled={chatLoading || !customPrompt.trim()}
                  className="p-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-lg cursor-pointer transition-colors shrink-0 flex items-center justify-center"
                >
                  <Send size={13} />
                </button>
              </form>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}
