import React, { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import Watchlist from './components/Watchlist';
import VideoFeed from './components/VideoFeed';
import ResearchTab from './components/ResearchTab';
import NewChannelsTab from './components/NewChannelsTab';
import NichesTab from './components/NichesTab';
import ThumbnailsTab from './components/ThumbnailsTab';
import NotesTab from './components/NotesTab';
import SettingsTab from './components/SettingsTab';
import IdeasTab from './components/IdeasTab';
import MyChannelTab from './components/MyChannelTab';
import VerdictTab from './components/VerdictTab';
import NicheCoachTab from './components/NicheCoachTab';
import { Menu, Users, Sparkles } from 'lucide-react';
import { Channel, Video } from './types';

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const stored = localStorage.getItem('app_theme');
      if (stored === 'light' || stored === 'dark') {
        return stored;
      }
      if (typeof window !== 'undefined' && window.matchMedia) {
        return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
      }
    } catch {
      // ignore
    }
    return 'dark';
  });

  useEffect(() => {
    try {
      const root = document.documentElement;
      if (theme === 'light') {
        root.classList.add('light');
        root.classList.remove('dark');
        localStorage.setItem('app_theme', 'light');
      } else {
        root.classList.add('dark');
        root.classList.remove('light');
        localStorage.setItem('app_theme', 'dark');
      }
    } catch {
      // ignore
    }
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const [activeTab, setActiveTab] = useState<string>('home');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileWatchlistOpen, setMobileWatchlistOpen] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [filterFormat, setFilterFormat] = useState<'all' | 'long' | 'short'>('all');
  const [filterWindow, setFilterWindow] = useState<'7d' | '28d' | '90d'>('28d');
  const [sortOption, setSortOption] = useState<'outlier' | 'date' | 'views' | 'subs'>('outlier');
  const [searchQuery, setSearchQuery] = useState('');
  const [quotaUsed, setQuotaUsed] = useState(0);

  const [showEmailAuthModal, setShowEmailAuthModal] = useState(false);
  const [emailAuthMode, setEmailAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const handleEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    const url = emailAuthMode === 'signup' ? '/api/auth/email/signup' : '/api/auth/email/signin';
    const payload = emailAuthMode === 'signup' 
      ? { email: authEmail, name: authName, password: authPassword }
      : { email: authEmail, password: authPassword };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      if (data.token && data.user) {
        localStorage.setItem('oauth_token', data.token);
        localStorage.setItem('oauth_user', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        setShowEmailAuthModal(false);
        
        // Reset fields
        setAuthEmail('');
        setAuthPassword('');
        setAuthName('');
        
        // Refresh data
        setTimeout(() => {
          fetchChannels();
          fetchVideos();
          fetchQuota();
        }, 100);
      }
    } catch (err: any) {
      setAuthError(err.message || 'An error occurred during authentication');
    } finally {
      setAuthLoading(false);
    }
  };

  const [user, setUser] = useState<{ id: string; email: string; name: string; picture: string } | null>(() => {
    try {
      const stored = localStorage.getItem('oauth_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('oauth_token'));

  // Custom fetch helper that automatically appends auth token
  const authFetch = async (url: string, options: RequestInit = {}) => {
    const activeToken = localStorage.getItem('oauth_token') || token;
    const headers = {
      ...options.headers,
      ...(activeToken ? { 'Authorization': `Bearer ${activeToken}` } : {})
    };
    return fetch(url, { ...options, headers });
  };

  const fetchChannels = async () => {
    try {
      const res = await authFetch('/api/watchlist');
      const data = await res.json();
      if (Array.isArray(data)) {
        setChannels(data);
      } else {
        setChannels([]);
      }
    } catch (err) {
      console.error('Error fetching channels:', err);
      setChannels([]);
    }
  };

  const fetchVideos = async () => {
    try {
      const res = await authFetch(`/api/videos?format=${filterFormat}&window=${filterWindow}&sort=${sortOption}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setVideos(data);
      } else {
        setVideos([]);
      }
    } catch (err) {
      console.error('Error fetching videos:', err);
      setVideos([]);
    }
  };

  const fetchQuota = async () => {
    try {
      const res = await authFetch('/api/settings');
      const data = await res.json();
      setQuotaUsed(data.quota_used || 0);
    } catch (err) {
      console.error(err);
    }
  };

  const checkAlertLogs = async () => {
    if (!user) return;
    try {
      const res = await authFetch('/api/alert-logs');
      if (res.ok) {
        const logs = await res.json();
        const unreadLogs = logs.filter((l: any) => l.is_read === 0);
        if (unreadLogs.length > 0) {
          if (Notification.permission === 'granted') {
            unreadLogs.forEach((log: any) => {
              new Notification(`Outlier Alert: ${log.channel_name}`, {
                body: log.message,
                icon: log.thumbnail_url || log.avatar_url
              });
            });
          } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
              if (permission === 'granted') {
                unreadLogs.forEach((log: any) => {
                  new Notification(`Outlier Alert: ${log.channel_name}`, {
                    body: log.message,
                    icon: log.thumbnail_url || log.avatar_url
                  });
                });
              }
            });
          }
          await authFetch('/api/alert-logs/read', { method: 'POST' });
        }
      }
    } catch (err) {
      console.error('Failed to fetch alert logs', err);
    }
  };

  useEffect(() => {
    if (user) {
      const interval = setInterval(checkAlertLogs, 30000); // Check every 30s
      checkAlertLogs(); // Check immediately on mount
      return () => clearInterval(interval);
    }
  }, [user]);

  // Check login state on mount
  const checkLogin = async () => {
    try {
      const res = await authFetch('/api/auth/me');
      const data = await res.json();
      if (data.loggedIn && data.user) {
        const fullUser = {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          picture: data.user.avatar_url
        };
        localStorage.setItem('oauth_user', JSON.stringify(fullUser));
        setUser(fullUser);
      } else {
        // If server says not logged in, clean up local state
        localStorage.removeItem('oauth_user');
        localStorage.removeItem('oauth_token');
        setUser(null);
        setToken(null);
      }
    } catch (err) {
      console.error('Error checking login:', err);
    }
  };

  useEffect(() => {
    checkLogin().finally(() => {
      fetchChannels();
      fetchQuota();
    });

    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        const { token: receivedToken, user: receivedUser } = event.data;
        if (receivedToken && receivedUser) {
          localStorage.setItem('oauth_token', receivedToken);
          localStorage.setItem('oauth_user', JSON.stringify(receivedUser));
          setToken(receivedToken);
          setUser(receivedUser);
          
          setTimeout(() => {
            fetchChannels();
            fetchVideos();
            fetchQuota();
          }, 100);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    fetchVideos();
  }, [filterFormat, filterWindow, sortOption]);

  const handleLogin = async () => {
    try {
      const redirectUri = `${window.location.origin}/auth/callback`;
      const res = await fetch(`/api/auth/url?redirectUri=${encodeURIComponent(redirectUri)}`);
      if (!res.ok) throw new Error('Failed to fetch login URL');
      const { url } = await res.json();

      const authWindow = window.open(url, 'google_oauth_popup', 'width=600,height=700');
      if (!authWindow) {
        alert('Please allow popups to sign in with Google.');
      }
    } catch (err) {
      console.error('Google Auth error:', err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('oauth_user');
    localStorage.removeItem('oauth_token');
    setUser(null);
    setToken(null);
    setTimeout(() => {
      fetchChannels();
      fetchVideos();
      fetchQuota();
    }, 100);
  };

  const handleAddChannel = async (identifier: string) => {
    await authFetch('/api/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier })
    });
    await fetchChannels();
    await fetchVideos();
    await fetchQuota();
  };

  const handleRefreshAll = async () => {
    await authFetch('/api/refresh', { method: 'POST' });
    await fetchChannels();
    await fetchVideos();
    await fetchQuota();
  };

  const handleIgnore = async (id: string) => {
    await authFetch(`/api/videos/${id}/ignore`, { method: 'POST' });
    setVideos(videos.filter(v => v.id !== id));
  };


  const filteredVideos = videos.filter(v => 
    v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.channel_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderActiveTabContent = () => {
    switch (activeTab) {
      case 'research':
        return (
          <ResearchTab 
            onAddChannel={handleAddChannel} 
            watchlistChannelIds={channels.map(c => c.id)} 
          />
        );
      case 'new_channels':
        return <NewChannelsTab />;
      case 'niches':
        return <NichesTab />;
      case 'thumbs':
        return <ThumbnailsTab />;
      case 'notes':
        return <NotesTab />;
      case 'ideas':
        return (
          <IdeasTab 
            channels={channels} 
            videos={videos} 
          />
        );
      case 'my_channel':
        return <MyChannelTab />;
      case 'verdict':
        return <VerdictTab />;
      case 'coach':
        return <NicheCoachTab onNavigateToResearch={() => setActiveTab('research')} />;
      case 'settings':
        return <SettingsTab />;
      case 'home':
      default:
        return (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            <header className="p-6 border-b border-[var(--line)]">
              <div className="header-top flex justify-between items-start mb-4">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">Winning Outliers</h1>
                  <p className="subtext text-[0.8rem] text-[var(--muted)] mt-1">
                    Showing {filteredVideos.length} videos that significantly exceeded their channel's baseline performance.
                  </p>
                </div>
                <div className="filters flex gap-2 items-center">
                  {['7d', '28d', '90d'].map(win => (
                    <button 
                      key={win}
                      onClick={() => setFilterWindow(win as any)}
                      className={`filter-btn px-3 py-1.5 rounded-md text-xs border cursor-pointer transition-all ${
                        filterWindow === win ? 'active' : ''
                      }`}
                    >
                      {win}
                    </button>
                  ))}
                </div>
              </div>
              <div className="filters flex gap-2 items-center">
                <button 
                  onClick={() => setFilterFormat('all')} 
                  className={`filter-btn px-3 py-1.5 rounded-md text-xs border cursor-pointer transition-all ${
                    filterFormat === 'all' ? 'active' : ''
                  }`}
                >
                  All Formats
                </button>
                <button 
                  onClick={() => setFilterFormat('long')} 
                  className={`filter-btn px-3 py-1.5 rounded-md text-xs border cursor-pointer transition-all ${
                    filterFormat === 'long' ? 'active' : ''
                  }`}
                >
                  Long-form
                </button>
                <button 
                  onClick={() => setFilterFormat('short')} 
                  className={`filter-btn px-3 py-1.5 rounded-md text-xs border cursor-pointer transition-all ${
                    filterFormat === 'short' ? 'active' : ''
                  }`}
                >
                  Shorts
                </button>
                
                <div className="flex-1"></div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--muted)] font-mono">Sort by:</span>
                  <select 
                    value={sortOption} 
                    onChange={(e) => setSortOption(e.target.value as any)}
                    className="bg-[var(--card-bg)] border border-[var(--line)] text-[var(--ink)] px-2.5 py-1.5 rounded-md text-xs outline-none focus:border-[var(--accent)] font-semibold cursor-pointer"
                  >
                    <option value="outlier">Outlier Multiplier</option>
                    <option value="date">Upload Date</option>
                    <option value="views">Raw Views</option>
                    <option value="subs">Channel Size</option>
                  </select>
                </div>

                <input 
                  type="text" 
                  placeholder="Filter by title..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)] px-3 py-1.5 rounded-md text-xs w-[180px] outline-none focus:border-[var(--accent)]"
                />
              </div>
            </header>

            <VideoFeed videos={filteredVideos} onIgnore={handleIgnore} />
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen w-full bg-[var(--bg)] text-[var(--ink)] overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex shrink-0">
        <Sidebar 
          activeTab={activeTab} 
          onTabChange={setActiveTab} 
          user={user} 
          onLogin={handleLogin} 
          onEmailAuth={() => {
            setAuthError('');
            setShowEmailAuthModal(true);
          }}
          onLogout={handleLogout} 
          theme={theme}
          onToggleTheme={handleToggleTheme}
        />
      </div>
      
      <main className="flex-1 flex flex-col h-full border-r border-[var(--line)] overflow-hidden">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-3 border-b border-[var(--line)] bg-[#070a13] shrink-0">
          <button 
            onClick={() => setMobileSidebarOpen(true)}
            className="p-1.5 hover:bg-[#121824] border border-[var(--line)] rounded-lg text-[var(--muted)] hover:text-white transition-colors cursor-pointer"
          >
            <Menu size={18} />
          </button>
          <div className="flex items-center gap-1.5">
            <Sparkles size={14} className="text-amber-500 animate-pulse" />
            <span className="font-bold text-xs text-white">Faceless Copilot</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent)] font-semibold border border-[var(--accent)]/20 capitalize font-mono">
              {activeTab.replace('_', ' ')}
            </span>
          </div>
          {activeTab !== 'settings' && activeTab !== 'notes' && activeTab !== 'ideas' && activeTab !== 'my_channel' && activeTab !== 'verdict' && activeTab !== 'coach' ? (
            <button 
              onClick={() => setMobileWatchlistOpen(true)}
              className="p-1.5 hover:bg-[#121824] border border-[var(--line)] rounded-lg text-[var(--muted)] hover:text-white transition-colors cursor-pointer"
            >
              <Users size={18} />
            </button>
          ) : (
            <div className="w-8 h-8" />
          )}
        </div>

        {renderActiveTabContent()}
      </main>

      {/* Desktop Watchlist */}
      {activeTab !== 'settings' && activeTab !== 'notes' && activeTab !== 'ideas' && activeTab !== 'my_channel' && activeTab !== 'verdict' && activeTab !== 'coach' && (
        <div className="hidden lg:flex shrink-0">
          <Watchlist 
            channels={channels} 
            onAddChannel={handleAddChannel} 
            onRefreshAll={handleRefreshAll} 
          />
        </div>
      )}

      {/* Mobile Sidebar drawer */}
      <div className={`fixed inset-0 z-50 md:hidden transition-opacity duration-300 ${mobileSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-black/70 backdrop-blur-xs" onClick={() => setMobileSidebarOpen(false)} />
        <div className={`absolute top-0 bottom-0 left-0 w-[240px] bg-[#05070a] border-r border-[var(--line)] transition-transform duration-300 transform ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <Sidebar 
            activeTab={activeTab} 
            onTabChange={(tab) => {
              setActiveTab(tab);
              setMobileSidebarOpen(false);
            }} 
            user={user} 
            onLogin={handleLogin} 
            onEmailAuth={() => {
              setAuthError('');
              setShowEmailAuthModal(true);
            }}
            onLogout={handleLogout} 
            theme={theme}
            onToggleTheme={handleToggleTheme}
          />
        </div>
      </div>

      {/* Mobile Watchlist drawer */}
      {activeTab !== 'settings' && activeTab !== 'notes' && activeTab !== 'ideas' && activeTab !== 'my_channel' && activeTab !== 'verdict' && activeTab !== 'coach' && (
        <div className={`fixed inset-0 z-50 lg:hidden transition-opacity duration-300 ${mobileWatchlistOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-xs" onClick={() => setMobileWatchlistOpen(false)} />
          <div className={`absolute top-0 bottom-0 right-0 w-[280px] bg-[#05070a] border-l border-[var(--line)] transition-transform duration-300 transform ${mobileWatchlistOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <Watchlist 
              channels={channels} 
              onAddChannel={handleAddChannel} 
              onRefreshAll={handleRefreshAll} 
            />
          </div>
        </div>
      )}

      {/* Email Auth Modal */}
      {showEmailAuthModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-xs z-[100] flex items-center justify-center p-4">
          <div className="bg-[#0b0f17] border border-[var(--line)] rounded-2xl w-full max-w-md shadow-2xl p-6 relative">
            <button 
              onClick={() => setShowEmailAuthModal(false)}
              className="absolute top-4 right-4 text-[var(--muted)] hover:text-white p-1.5 rounded-lg hover:bg-[var(--line)] transition-colors cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-white mb-1">
                {emailAuthMode === 'signin' ? 'Welcome Back' : 'Create an Account'}
              </h2>
              <p className="text-xs text-[var(--muted)]">
                {emailAuthMode === 'signin' ? 'Sign in to access your custom tracker' : 'Register with your email to sync and save progress'}
              </p>
            </div>

            {authError && (
              <div className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-500/20 text-red-400 text-xs text-center font-medium">
                {authError}
              </div>
            )}

            <form onSubmit={handleEmailAuthSubmit} className="space-y-4">
              {emailAuthMode === 'signup' && (
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-[var(--muted)] mb-1.5 font-semibold">
                    Full Name
                  </label>
                  <input 
                    type="text" 
                    required
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full bg-[var(--bg)] border border-[var(--line)] text-white px-3.5 py-2 rounded-lg text-xs outline-none focus:border-[var(--accent)] transition-colors"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[var(--muted)] mb-1.5 font-semibold">
                  Email Address
                </label>
                <input 
                  type="email" 
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-[var(--bg)] border border-[var(--line)] text-white px-3.5 py-2 rounded-lg text-xs outline-none focus:border-[var(--accent)] transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[var(--muted)] mb-1.5 font-semibold">
                  Password
                </label>
                <input 
                  type="password" 
                  required
                  minLength={6}
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[var(--bg)] border border-[var(--line)] text-white px-3.5 py-2 rounded-lg text-xs outline-none focus:border-[var(--accent)] transition-colors"
                />
              </div>

              <button 
                type="submit"
                disabled={authLoading}
                className="w-full bg-[var(--accent)] text-white py-2.5 rounded-lg text-xs font-semibold hover:brightness-110 transition-all cursor-pointer flex items-center justify-center gap-2 mt-2 disabled:opacity-50 font-mono tracking-wider uppercase"
              >
                {authLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <span>{emailAuthMode === 'signin' ? 'Sign In' : 'Sign Up'}</span>
                )}
              </button>
            </form>

            <div className="mt-6 pt-4 border-t border-[var(--line)]/50 text-center text-xs text-[var(--muted)]">
              {emailAuthMode === 'signin' ? (
                <span>
                  Don't have an account?{' '}
                  <button 
                    onClick={() => {
                      setAuthError('');
                      setEmailAuthMode('signup');
                    }}
                    className="text-[var(--accent)] hover:underline font-semibold cursor-pointer ml-1"
                  >
                    Sign Up
                  </button>
                </span>
              ) : (
                <span>
                  Already have an account?{' '}
                  <button 
                    onClick={() => {
                      setAuthError('');
                      setEmailAuthMode('signin');
                    }}
                    className="text-[var(--accent)] hover:underline font-semibold cursor-pointer ml-1"
                  >
                    Sign In
                  </button>
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
