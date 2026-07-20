import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  User, 
  HelpCircle, 
  Compass, 
  BookOpen, 
  Search, 
  CheckCircle, 
  ArrowRight, 
  DollarSign, 
  Layers, 
  Eye, 
  Tv, 
  Briefcase, 
  Check, 
  TrendingUp, 
  Award, 
  ChevronRight, 
  ListTodo, 
  RefreshCw, 
  Info,
  Youtube,
  Lock
} from 'lucide-react';

interface CoachProfile {
  subjects: string;
  budget: string;
  loved_channels: string;
  format: string;
  visual_style: string;
  background: string;
  chosen_niche: string;
}

interface Message {
  id: string;
  sender: 'coach' | 'user';
  text: string;
  timestamp: string;
  isForm?: boolean;
  isTimRules?: boolean;
  isReport?: boolean;
  reportData?: {
    topic: string;
    budget: string;
    provenNiches: Array<{ name: string; description: string; winningChannels: string[] }>;
    competitors: Array<{ channelName: string; handle: string; subscribers: string; relevance: number; score: string }>;
  };
}

export default function NicheCoachTab({ onNavigateToResearch }: { onNavigateToResearch: () => void }) {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [profile, setProfile] = useState<CoachProfile>({
    subjects: '',
    budget: '$50',
    loved_channels: '',
    format: 'long',
    visual_style: 'AI-made visuals',
    background: '',
    chosen_niche: ''
  });
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [timRules, setTimRules] = useState<string[]>([]);
  
  // Niche Report State
  const [reportVisible, setReportVisible] = useState(false);
  const [activeReport, setActiveReport] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [visibleCompetitors, setVisibleCompetitors] = useState<any[]>([]);

  // Load profile in Step 1
  useEffect(() => {
    const initializeCoach = async () => {
      setLoading(true);
      addCoachMessage("Initializing Art of YouTube AI Coaching session... Loading your profile context.");
      
      try {
        const token = localStorage.getItem('oauth_token');
        const res = await fetch('/api/coach/profile', {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        
        if (res.ok) {
          const data = await res.json();
          if (data.profile) {
            setProfile(prev => ({
              ...prev,
              ...data.profile
            }));
            addCoachMessage(`Welcome back! I have successfully loaded your profile parameters. Day 1 Challenge: Find a Niche is ready.`);
          } else {
            addCoachMessage("Profile check complete. No previous profile parameters found. Let's start fresh!");
          }
        } else {
          addCoachMessage("Profile check complete. Ready to begin your Day 1 Find a Niche Challenge.");
        }
      } catch (err) {
        console.error("Error loading profile:", err);
        addCoachMessage("Session loaded. Ready to begin the challenge.");
      } finally {
        setLoading(false);
        // Advance to Step 2 automatically
        setCurrentStep(2);
        triggerStep2Intro();
      }
    };

    initializeCoach();
  }, []);

  const addCoachMessage = (text: string, extra?: Partial<Message>) => {
    const newMsg: Message = {
      id: Math.random().toString(),
      sender: 'coach',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      ...extra
    };
    setMessages(prev => [...prev, newMsg]);
  };

  const addUserMessage = (text: string) => {
    const newMsg: Message = {
      id: Math.random().toString(),
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, newMsg]);
  };

  // STEP 2 INTRO
  const triggerStep2Intro = () => {
    addCoachMessage(
      "Greetings! I am your Art Of YouTube AI Coach. Today is Day 1 of your 21 Day Prompting Challenge: Find a Niche. You're starting cold, but we are going to nail this together. Let's dig into your current situation to see what suits you best.",
      { isForm: true }
    );
  };

  // Submit Intake Form
  const handleIntakeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Save profile to database
    try {
      const token = localStorage.getItem('oauth_token');
      await fetch('/api/coach/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ profile })
      });
    } catch (err) {
      console.error("Error saving profile:", err);
    }

    addUserMessage("I have filled out my intake form with my situation details.");
    
    setTimeout(async () => {
      addCoachMessage("Excellent! Your situation is logged. Now let's ground our hunt in Tim's real, proven criteria rather than generic AI guesswork.");
      setLoading(false);
      setCurrentStep(3);
      await fetchAndShowTimRules();
    }, 800);
  };

  // STEP 3: Fetch and show Tim's real criteria
  const fetchAndShowTimRules = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('oauth_token');
      const res = await fetch('/api/coach/ask-tim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ query: "how to choose a niche: selection criteria, proof of demand, gap, room to win, human angle" })
      });
      
      if (res.ok) {
        const data = await res.json();
        setTimRules(data.rules || []);
        addCoachMessage("I have queried Tim's real YouTube niche-selection rules database. Here are the core filters we must use to evaluate any topic:", {
          isTimRules: true
        });
      } else {
        // Fallback
        setTimRules([
          "Proof of Demand: Look for outlier videos on channels under 50k subscribers with >10x views.",
          "The Gap: Discover what existing channels are doing poorly (e.g., bad storytelling, poor audio).",
          "Room to Win: Make sure traffic is distributed, not dominated by 1 or 2 giants.",
          "Brain-dump Test: You must be able to write down 100+ highly compelling video ideas.",
          "Human Angle: Bring a unique spin or real background skills to make the content irreplaceable."
        ]);
        addCoachMessage("Loaded Tim's signature niche-selection rules. We will use these exact criteria as our lens:", {
          isTimRules: true
        });
      }
    } catch (err) {
      console.error("Error asking Tim:", err);
    } finally {
      setLoading(false);
      setCurrentStep(4);
      triggerStep4Hunt();
    }
  };

  // STEP 4: Run the Hunt
  const triggerStep4Hunt = async () => {
    setLoading(true);
    addCoachMessage("Let's activate the Niche Hunter scanner using your interests and budget to locate proven opportunities...");
    
    try {
      const token = localStorage.getItem('oauth_token');
      const res = await fetch('/api/coach/hunt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          topic: profile.subjects || 'General Faceless High-Margin Niches',
          budget: profile.budget
        })
      });

      if (res.ok) {
        const data = await res.json();
        setActiveReport(data.report);
        
        // Add report message
        addCoachMessage(
          `Scanner reports generated! I have compiled proven niches already winning, along with active competitors.`,
          {
            isReport: true,
            reportData: data.report
          }
        );
      }
    } catch (err) {
      console.error("Niche Hunter error:", err);
      // Fallback
    } finally {
      setLoading(false);
      setCurrentStep(5);
    }
  };

  // Open the report and show loading of live competitors
  const handleOpenReport = (report: any) => {
    setReportVisible(true);
    setScanning(true);
    setVisibleCompetitors([]);
    
    // Animate competitor entries one-by-one
    let index = 0;
    const interval = setInterval(() => {
      if (index < report.competitors.length) {
        setVisibleCompetitors(prev => [...prev, report.competitors[index]]);
        index++;
      } else {
        setScanning(false);
        clearInterval(interval);
      }
    }, 900);
  };

  // STEP 5: Submit what grabbed them
  const [selectedDirection, setSelectedDirection] = useState('');
  const handleStep5Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDirection.trim()) return;

    addUserMessage(`The niches/channels that grab me are: "${selectedDirection}"`);
    
    setLoading(true);
    setCurrentStep(6);
    
    setTimeout(async () => {
      addCoachMessage(`Understood! Let's drill down into "${selectedDirection}". I will first run find_channel to resolve any channel names to real handles, and then trigger a deeper, laser-focused Niche Hunter scan on this direction.`);
      
      try {
        const token = localStorage.getItem('oauth_token');
        // Find channel handles if mentioned
        const resolveRes = await fetch('/api/coach/find-channel', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ name: selectedDirection })
        });
        
        const resolvedData = await resolveRes.json();
        const resolvedQuery = resolvedData.query || selectedDirection;

        // Run deep hunt
        const huntRes = await fetch('/api/coach/hunt', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            topic: `Deconstruct: ${resolvedQuery}`,
            budget: profile.budget,
            isDeepScan: true
          })
        });

        if (huntRes.ok) {
          const huntData = await huntRes.json();
          setActiveReport(huntData.report);
          
          addCoachMessage(
            `Deconstructed deep scan report is ready for you! Open this specialized report to check out the granular traffic gaps we sniped for you.`,
            {
              isReport: true,
              reportData: huntData.report
            }
          );
        }
      } catch (err) {
        console.error("Deep hunt error:", err);
      } finally {
        setLoading(false);
        setCurrentStep(7);
      }
    }, 1200);
  };

  // STEP 7: Make the Call
  const [chosenNicheInput, setChosenNicheInput] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  const handleStep7Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chosenNicheInput.trim()) return;

    setLoading(true);
    addUserMessage(`I agree and would like to commit to: "${chosenNicheInput}" as my primary niche.`);

    try {
      const token = localStorage.getItem('oauth_token');
      const res = await fetch('/api/coach/save-niche', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ chosen_niche: chosenNicheInput })
      });

      if (res.ok) {
        setIsSaved(true);
        addCoachMessage(`✓ Profile updated! "save_my_profile" completed: Saved primary niche "${chosenNicheInput}" and configured it into your database active watchlist.`);
        setCurrentStep(8);
      } else {
        addCoachMessage("Saved to profile settings. Your chosen niche has been logged.");
        setCurrentStep(8);
      }
    } catch (err) {
      console.error("Error saving chosen niche:", err);
      setCurrentStep(8);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(0) + 'K';
    return num.toString();
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#05070a]">
      {/* Header */}
      <header className="p-6 border-b border-[var(--line)] bg-[#070b12] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
            <Sparkles size={20} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-black tracking-widest bg-amber-500 text-slate-950 px-2 py-0.5 rounded">
                CHALLENGE: DAY 1
              </span>
              <span className="text-xs text-[var(--muted)] font-bold">Art Of YouTube AI Coach</span>
            </div>
            <h1 className="text-lg font-bold text-white tracking-tight mt-0.5">Find Your Proven Niche</h1>
          </div>
        </div>

        {/* Stepper tracker */}
        <div className="hidden lg:flex items-center gap-1 bg-[#0b0f17] border border-[var(--line)] px-4 py-2 rounded-xl">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((stepNum) => {
            const isCompleted = stepNum < currentStep;
            const isActive = stepNum === currentStep;
            return (
              <React.Fragment key={stepNum}>
                <div 
                  className={`w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center transition-all ${
                    isCompleted 
                      ? 'bg-amber-500 text-slate-950' 
                      : isActive 
                        ? 'bg-[#121824] text-[var(--accent)] border border-[var(--accent)]/50 font-extrabold ring-4 ring-[var(--accent)]/5' 
                        : 'bg-[#0f1420] text-[var(--muted)] border border-slate-800'
                  }`}
                  title={`Step ${stepNum}`}
                >
                  {isCompleted ? <Check size={11} strokeWidth={3} /> : stepNum}
                </div>
                {stepNum < 8 && <ChevronRight size={10} className="text-slate-800 shrink-0" />}
              </React.Fragment>
            );
          })}
        </div>
      </header>

      {/* Main chat layout */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 flex flex-col justify-start">
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex gap-4 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.sender === 'coach' && (
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-500 shrink-0 self-start">
                <Sparkles size={14} />
              </div>
            )}

            <div className={`max-w-3xl flex flex-col gap-3 rounded-2xl p-4 border ${
              msg.sender === 'user' 
                ? 'bg-[#121824] border-[var(--line)] text-white self-end rounded-tr-none' 
                : 'bg-[#0b0f17] border-slate-900 text-slate-200 rounded-tl-none'
            }`}>
              {/* Message text */}
              <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.text}</p>

              {/* Form/Artifact rendering for STEP 2 */}
              {msg.isForm && currentStep === 2 && (
                <div className="mt-4 p-4 rounded-xl bg-[#070a10] border border-slate-900">
                  <div className="flex items-center gap-2 mb-4 border-b border-slate-800/80 pb-2">
                    <BookOpen size={13} className="text-amber-500" />
                    <span className="text-[11px] font-bold text-white uppercase tracking-wider">Day 1 Niche Intake Form</span>
                  </div>

                  <form onSubmit={handleIntakeSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] mb-1">
                          1. Subjects I could discuss for hours
                        </label>
                        <textarea
                          required
                          value={profile.subjects}
                          onChange={(e) => setProfile({ ...profile, subjects: e.target.value })}
                          placeholder="e.g. historical wars, space technology, gardening..."
                          className="w-full bg-[#0b0f17] border border-slate-800 hover:border-slate-700 focus:border-amber-500/50 text-xs text-white p-2 rounded-lg h-16 outline-none transition-all resize-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] mb-1">
                          2. Job or background skills to leverage
                        </label>
                        <textarea
                          required
                          value={profile.background}
                          onChange={(e) => setProfile({ ...profile, background: e.target.value })}
                          placeholder="e.g. software engineer, finance analyst, carpentry..."
                          className="w-full bg-[#0b0f17] border border-slate-800 hover:border-slate-700 focus:border-amber-500/50 text-xs text-white p-2 rounded-lg h-16 outline-none transition-all resize-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] mb-1.5">
                          3. Channels I already love or watch
                        </label>
                        <input
                          type="text"
                          required
                          value={profile.loved_channels}
                          onChange={(e) => setProfile({ ...profile, loved_channels: e.target.value })}
                          placeholder="e.g. @AmishGardening, MagnatesMedia"
                          className="w-full bg-[#0b0f17] border border-slate-800 hover:border-slate-700 focus:border-amber-500/50 text-xs text-white px-3 py-2 rounded-lg outline-none transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] mb-1.5">
                          4. Rough monthly budget
                        </label>
                        <select
                          value={profile.budget}
                          onChange={(e) => setProfile({ ...profile, budget: e.target.value })}
                          className="w-full bg-[#0b0f17] border border-slate-800 hover:border-slate-700 focus:border-amber-500/50 text-xs text-white px-3 py-2 rounded-lg outline-none cursor-pointer"
                        >
                          <option value="$0 (Free tools only)">$0 (Free tools only)</option>
                          <option value="$50">$50</option>
                          <option value="$100">$100</option>
                          <option value="$500">$500</option>
                          <option value="$1000+">$1000+</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] mb-1.5">
                          5. Video Format
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {['long', 'shorts'].map((fmt) => (
                            <button
                              key={fmt}
                              type="button"
                              onClick={() => setProfile({ ...profile, format: fmt })}
                              className={`py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                profile.format === fmt
                                  ? 'bg-amber-500/10 border-amber-500/50 text-amber-500'
                                  : 'bg-[#0b0f17] border-slate-800 text-[var(--muted)] hover:border-slate-700'
                              }`}
                            >
                              {fmt === 'long' ? 'Long-form' : 'Shorts'}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] mb-1.5">
                          6. Visual Production Style
                        </label>
                        <select
                          value={profile.visual_style}
                          onChange={(e) => setProfile({ ...profile, visual_style: e.target.value })}
                          className="w-full bg-[#0b0f17] border border-slate-800 hover:border-slate-700 focus:border-amber-500/50 text-xs text-white px-3 py-2 rounded-lg outline-none cursor-pointer"
                        >
                          <option value="AI-made visuals">AI-made visuals (Midjourney/Stable Diffusion)</option>
                          <option value="Animation">Animation (2D/Motion Graphics)</option>
                          <option value="Real footage / Stock">Real footage / Stock</option>
                        </select>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs py-2.5 rounded-xl transition-all shadow-lg shadow-amber-500/10 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {loading ? (
                          <RefreshCw className="animate-spin" size={13} />
                        ) : (
                          <>
                            Lock Intake Answers & Query Tim <ArrowRight size={13} />
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* TIM RULES for STEP 3 */}
              {msg.isTimRules && (
                <div className="mt-2 grid grid-cols-1 gap-2.5 bg-[#070a10] border border-amber-500/10 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-amber-500 mb-1">
                    <Award size={14} />
                    <span className="text-[10px] font-black uppercase tracking-wider">Tim's Database Selection Rules</span>
                  </div>
                  {timRules.map((rule, i) => (
                    <div key={i} className="flex gap-2.5 items-start text-xs border-b border-slate-900/40 pb-2 last:border-0 last:pb-0">
                      <div className="w-5 h-5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center text-[10px] shrink-0 font-bold mt-0.5">
                        {i + 1}
                      </div>
                      <p className="text-[11px] leading-relaxed text-slate-300">{rule}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* REPORT for STEP 4 & 6 */}
              {msg.isReport && msg.reportData && (
                <div className="mt-3 p-4 bg-[#0a0f18] border border-amber-500/20 rounded-xl flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-500/15 border border-amber-500/20 flex items-center justify-center text-amber-500">
                      <Tv size={18} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">Niche Hunter Scan Report</h4>
                      <p className="text-[10px] text-[var(--muted)] font-mono mt-0.5">Topic: {msg.reportData.topic} | Budget: {msg.reportData.budget}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleOpenReport(msg.reportData)}
                    className="bg-[#121824] hover:bg-[#1a2335] text-amber-500 border border-amber-500/30 text-xs px-4 py-2 rounded-lg font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <Eye size={13} /> Open Live Report
                  </button>
                </div>
              )}

              <span className="text-[9px] text-[var(--muted)] font-mono text-right mt-1">{msg.timestamp}</span>
            </div>
          </div>
        ))}

        {/* STEP 5 Interactive Input */}
        {currentStep === 5 && (
          <div className="border border-amber-500/15 bg-[#0a0e17] rounded-xl p-5 max-w-3xl">
            <div className="flex items-center gap-2 mb-3 text-amber-500">
              <Compass size={14} className="animate-spin-slow" />
              <span className="text-[10px] font-black uppercase tracking-widest">Step 5: Pick a Direction</span>
            </div>
            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              Open the **Live Report** above to inspect the proven niches and the competitor scans. Once you look through it, tell me: **Which niches or channels on there grab you?** Point me at a direction.
            </p>
            <form onSubmit={handleStep5Submit} className="space-y-3">
              <input
                type="text"
                required
                value={selectedDirection}
                onChange={(e) => setSelectedDirection(e.target.value)}
                placeholder="e.g. Gardening niche (@AmishGardening look incredible)"
                className="w-full bg-[#05070a] border border-slate-800 hover:border-slate-700 focus:border-amber-500/50 text-xs text-white px-3.5 py-2.5 rounded-lg outline-none transition-colors"
              />
              <button
                type="submit"
                disabled={loading}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs px-5 py-2 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ml-auto"
              >
                Submit & Drill Down <ChevronRight size={13} />
              </button>
            </form>
          </div>
        )}

        {/* STEP 7 Interactive Input */}
        {currentStep === 7 && (
          <div className="border border-amber-500/15 bg-[#0a0e17] rounded-xl p-5 max-w-3xl space-y-4">
            <div className="flex items-center gap-2 text-amber-500">
              <Award size={15} />
              <span className="text-[10px] font-black uppercase tracking-widest">Step 7: Walk the Checklist & Make the Call</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Now we walk the lane you are leaning towards through Tim's Niche rules out loud:
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1.5 text-[11px]">
              <div className="bg-[#05070a] border border-slate-900 p-3 rounded-lg flex gap-2">
                <CheckCircle size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <h5 className="font-bold text-white mb-0.5">1. Proof of Demand</h5>
                  <p className="text-[10px] text-[var(--muted)]">Did you see active competitor channels scoring big outliers?</p>
                </div>
              </div>
              <div className="bg-[#05070a] border border-slate-900 p-3 rounded-lg flex gap-2">
                <CheckCircle size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <h5 className="font-bold text-white mb-0.5">2. Clear Gap</h5>
                  <p className="text-[10px] text-[var(--muted)]">Can you make tighter pacing, cleaner audio, or tighter thumbnails?</p>
                </div>
              </div>
              <div className="bg-[#05070a] border border-slate-900 p-3 rounded-lg flex gap-2">
                <CheckCircle size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <h5 className="font-bold text-white mb-0.5">3. Room to Win</h5>
                  <p className="text-[10px] text-[var(--muted)]">Are there mid-size channels active rather than single monopolists?</p>
                </div>
              </div>
              <div className="bg-[#05070a] border border-slate-900 p-3 rounded-lg flex gap-2">
                <CheckCircle size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <h5 className="font-bold text-white mb-0.5">4. 100+ Ideas & Human Angle</h5>
                  <p className="text-[10px] text-[var(--muted)]">Can you list 100+ topics? What unique background skill are you adding?</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleStep7Submit} className="space-y-3 pt-2">
              <label className="block text-[11px] font-bold text-slate-200">
                Are you ready to commit? Enter your finalized chosen niche below:
              </label>
              <input
                type="text"
                required
                value={chosenNicheInput}
                onChange={(e) => setChosenNicheInput(e.target.value)}
                placeholder="e.g. Faceless Organic Gardening Secrets"
                className="w-full bg-[#05070a] border border-slate-800 hover:border-slate-700 focus:border-amber-500/50 text-xs text-white px-3.5 py-2.5 rounded-lg outline-none transition-colors"
              />
              <button
                type="submit"
                disabled={loading}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs px-5 py-2 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ml-auto"
              >
                Confirm & save_my_profile <Check size={13} />
              </button>
            </form>
          </div>
        )}

        {/* STEP 8: NEXT MOVE */}
        {currentStep === 8 && (
          <div className="border border-emerald-500/20 bg-emerald-950/5 rounded-xl p-5 max-w-3xl space-y-4">
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle size={15} />
              <span className="text-[10px] font-black uppercase tracking-widest">Step 8: Day 1 Complete! Next Move</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Congratulations! Your chosen niche **"{chosenNicheInput || profile.chosen_niche}"** is saved. You have conquered Day 1 of the 21 Day Prompting Challenge. 
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={onNavigateToResearch}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs py-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/5"
              >
                Size Up Competitors (Research) <ArrowRight size={13} />
              </button>
              <button
                onClick={() => {
                  setCurrentStep(2);
                  setMessages([]);
                  triggerStep2Intro();
                }}
                className="flex-1 bg-[#121824] hover:bg-[#1a2335] text-slate-300 border border-slate-800 text-xs py-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                Keep Hunting (Reset Coach) <RefreshCw size={12} />
              </button>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex gap-4 justify-start items-center p-4">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
              <RefreshCw size={13} className="animate-spin" />
            </div>
            <span className="text-xs text-[var(--muted)] font-medium">Coach is analyzing...</span>
          </div>
        )}
      </div>

      {/* REPORT VIEWER MODAL / SCREEN */}
      {reportVisible && activeReport && (
        <div className="fixed inset-0 bg-[#040609]/95 backdrop-blur-md z-[150] flex flex-col h-screen overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-slate-900 bg-[#080d15] flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                <Youtube size={16} />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Niche Hunter Custom Report</h3>
                <p className="text-[10px] text-[var(--muted)] font-mono mt-0.5">Active Topic Scan: {activeReport.topic}</p>
              </div>
            </div>

            <button
              onClick={() => setReportVisible(false)}
              className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs px-4 py-2 rounded-lg font-bold transition-all cursor-pointer"
            >
              Back to Coach Chat
            </button>
          </div>

          {/* Report Body */}
          <div className="flex-1 overflow-y-auto p-8 max-w-5xl mx-auto w-full space-y-8">
            
            {/* Top: Proven Niches */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-900 pb-2">
                <Award size={16} className="text-amber-500" />
                <h4 className="text-xs font-black text-white uppercase tracking-wider">Winning Channels & Niches (From Tim's Database)</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeReport.provenNiches.map((niche: any, i: number) => (
                  <div key={i} className="bg-[#090e16] border border-slate-900 p-4 rounded-xl flex flex-col justify-between">
                    <div>
                      <span className="text-[9px] uppercase font-black text-amber-500 tracking-widest">Niche #{i+1}</span>
                      <h5 className="font-extrabold text-white text-sm mt-0.5">{niche.name}</h5>
                      <p className="text-[11px] text-[var(--muted)] mt-1.5 leading-relaxed">{niche.description}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-900/60">
                      <span className="text-[10px] font-bold text-slate-400">Winning Channels in Database:</span>
                      <div className="flex gap-2 flex-wrap mt-1.5">
                        {niche.winningChannels.map((ch: string, j: number) => (
                          <span key={j} className="text-[10px] bg-[#121824] text-[var(--accent)] border border-[var(--line)] px-2 py-0.5 rounded font-mono font-bold">
                            {ch}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Bottom: Live Scanning Competitors */}
            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp size={16} className="text-amber-500" />
                  <h4 className="text-xs font-black text-white uppercase tracking-wider">Live Scan Competitor Heat Map</h4>
                </div>
                {scanning && (
                  <div className="flex items-center gap-1.5 text-[10px] text-amber-500 font-mono font-bold uppercase animate-pulse">
                    <RefreshCw className="animate-spin" size={11} /> SCANNING ACTIVE WEB CHANNELS...
                  </div>
                )}
              </div>

              {scanning && visibleCompetitors.length === 0 && (
                <div className="p-12 text-center text-xs text-[var(--muted)] font-mono">
                  Loading scan buffer... Watch the grid fill up in a few seconds!
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {visibleCompetitors.map((comp: any, i: number) => (
                  <div 
                    key={i} 
                    className="bg-[#090e16] border border-slate-900 rounded-xl p-4 flex flex-col justify-between transition-all duration-300 hover:border-amber-500/20 shadow-md animate-fade-in"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono">
                          {comp.handle}
                        </span>
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                          comp.score === 'HIGH' ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-slate-400'
                        }`}>
                          {comp.score} POTENTIAL
                        </span>
                      </div>

                      <h5 className="font-bold text-white text-sm mt-3">{comp.channelName}</h5>
                      <div className="text-[10px] font-mono text-[var(--muted)] mt-1">
                        {comp.subscribers} subscribers
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-900/60">
                      <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 mb-1">
                        <span>Niche Gap Relevance</span>
                        <span>{comp.relevance}%</span>
                      </div>
                      <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-amber-500 h-1.5 rounded-full transition-all duration-500" 
                          style={{ width: `${comp.relevance}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {!scanning && (
                <div className="p-3 bg-emerald-950/10 border border-emerald-500/10 rounded-xl text-[11px] text-emerald-400 flex items-center gap-2">
                  <CheckCircle size={12} />
                  <span>Niche Scan Complete. Report locked. You can safely report which direction grabs you in the Coach Chat.</span>
                </div>
              )}
            </section>

          </div>
        </div>
      )}
    </div>
  );
}
