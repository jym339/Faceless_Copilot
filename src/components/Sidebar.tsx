import { Plus, Settings, TrendingUp, Search, Folder, Users, Image, FileText, Lightbulb, BarChart2, Award, Mail, Sparkles, Sun, Moon } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  user: { id: string; email: string; name: string; picture: string } | null;
  onLogin: () => void;
  onEmailAuth: () => void;
  onLogout: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export default function Sidebar({ activeTab, onTabChange, user, onLogin, onEmailAuth, onLogout, theme, onToggleTheme }: SidebarProps) {
  const primaryNavItems = [
    { id: 'home', label: 'Home', icon: TrendingUp },
    { id: 'research', label: 'Research', icon: Search },
    { id: 'ideas', label: 'Ideas', icon: Lightbulb },
    { id: 'new_channels', label: 'Competitors', icon: Users },
    { id: 'thumbs', label: 'Thumbs', icon: Image },
    { id: 'niches', label: 'Proven Niches', icon: Folder },
  ];

  const secondaryNavItems = [
    { id: 'my_channel', label: 'My Channel', icon: BarChart2 },
    { id: 'verdict', label: "James Verdict", icon: Award },
    { id: 'notes', label: 'My Notes', icon: FileText, hasBadge: true, badgeCount: 2 },
  ];

  return (
    <aside className="left-rail w-[200px] flex flex-col py-6 shrink-0 h-screen border-r border-[var(--line)] bg-[#05070a]">
      <div className="px-6 pb-8 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-inner shrink-0">
          <Sparkles size={16} />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="font-extrabold text-sm text-white tracking-tight leading-none">Faceless Copilot</span>
          <span className="text-[9px] font-bold text-[var(--muted)] tracking-widest mt-1">Mtk's World</span>
        </div>
      </div>
      
      {/* Primary Menu */}
      <nav className="flex flex-col gap-1">
        {primaryNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <div
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`nav-item flex items-center gap-3 py-2.5 px-6 text-xs cursor-pointer transition-colors hover:text-[var(--ink)] ${
                isActive ? 'active font-semibold text-white bg-[#121824]/40 border-l-2 border-[var(--accent)] pl-[22px]' : 'text-[var(--muted)]'
              }`}
            >
              <Icon size={16} className="shrink-0" />
              <span className="truncate">{item.label}</span>
            </div>
          );
        })}

        {/* Separator Line */}
        <div className="h-px bg-[var(--line)] my-3 mx-6" />

        {/* Secondary Menu */}
        {secondaryNavItems.map((item: any) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <div
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`nav-item flex items-center justify-between py-2.5 px-6 text-xs cursor-pointer transition-colors hover:text-[var(--ink)] ${
                isActive ? 'active font-semibold text-white bg-[#121824]/40 border-l-2 border-[var(--accent)] pl-[22px]' : 'text-[var(--muted)]'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Icon size={16} className="shrink-0" />
                <span className="truncate">{item.label}</span>
              </div>
              {item.hasBadge && (
                <span className="w-4 h-4 rounded-full bg-[#f97316] text-white flex items-center justify-center text-[9px] font-bold shrink-0">
                  {item.badgeCount}
                </span>
              )}
            </div>
          );
        })}
      </nav>

      {user ? (
        <div className="mt-auto px-4 pt-4 border-t border-[var(--line)] flex flex-col gap-2">
          <div className="flex items-center justify-between bg-[#0b0f17] border border-[var(--line)] p-2 rounded-xl">
            <div className="flex items-center gap-2 overflow-hidden min-w-0">
              {user.picture ? (
                <img src={user.picture} alt={user.name} referrerPolicy="no-referrer" className="w-7 h-7 rounded-full border border-[var(--line)] shrink-0" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 font-bold text-xs shrink-0 uppercase">
                  {user.name ? user.name[0] : 'U'}
                </div>
              )}
              <div className="overflow-hidden min-w-0">
                <div className="text-[10px] font-bold text-white truncate leading-none mb-1">{user.name}</div>
                <div className="text-[8px] text-[var(--muted)] font-medium truncate leading-none">AOY Program</div>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={onToggleTheme}
                className="p-1.5 hover:bg-[#121824] border border-[var(--line)] rounded-lg text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer transition-all shrink-0"
                title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
              >
                {theme === 'light' ? <Moon size={12} /> : <Sun size={12} />}
              </button>
              <button 
                onClick={() => onTabChange('settings')}
                className={`p-1.5 hover:bg-[#121824] border border-[var(--line)] rounded-lg text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer transition-all shrink-0 ${
                  activeTab === 'settings' ? 'bg-[#121824] text-[var(--accent)] border-[var(--accent)]/50' : ''
                }`}
                title="Settings"
              >
                <Settings size={12} />
              </button>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="text-left text-[10px] text-[var(--muted)] hover:text-red-400 mt-1 cursor-pointer transition-colors pl-1 font-medium"
          >
            Sign out
          </button>
        </div>
      ) : (
        <div className="mt-auto px-4 pt-4 border-t border-[var(--line)] flex flex-col gap-2">
          <div className="flex gap-2">
            <button 
              onClick={() => onTabChange('settings')}
              className={`flex-1 flex items-center justify-center gap-2 bg-[#121824]/50 border border-[var(--line)] text-[11px] text-[var(--muted)] py-2 rounded hover:bg-[#1a1f26] cursor-pointer transition-all ${
                activeTab === 'settings' ? 'bg-[#121824] text-[var(--accent)] border-[var(--accent)]/50' : ''
              }`}
            >
              <Settings size={13} />
              <span className="truncate">Settings</span>
            </button>
            <button
              onClick={onToggleTheme}
              className="p-2 bg-[#121824]/50 border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)] rounded hover:bg-[#1a1f26] cursor-pointer transition-all flex items-center justify-center shrink-0"
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
              {theme === 'light' ? <Moon size={13} /> : <Sun size={13} />}
            </button>
          </div>

          <button 
            onClick={onLogin}
            className="w-full flex items-center justify-center gap-2 bg-[#1a1f26] border border-[var(--line)] text-[11px] text-[var(--ink)] py-2 rounded hover:bg-[#252c36] cursor-pointer transition-all"
          >
            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.53 14.98 1 12 1 7.35 1 3.37 3.67 1.39 7.56l3.85 2.99c.92-2.75 3.48-4.51 6.76-4.51z"/>
              <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.43c-.28 1.47-1.11 2.72-2.36 3.56l3.66 2.84c2.14-1.97 3.38-4.88 3.38-8.55z"/>
              <path fill="#FBBC05" d="M5.24 14.55c-.24-.72-.38-1.5-.38-2.3s.14-1.58.38-2.3L1.39 7.56C.5 9.36 0 11.47 0 13.7s.5 4.34 1.39 6.14l3.85-2.99c-.24-.72-.38-1.5-.38-2.3z"/>
              <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.66-2.84c-1.01.68-2.31 1.09-3.9 1.09-3.28 0-5.84-1.76-6.76-4.51L1.79 16.8C3.77 20.69 7.75 23 12 23z"/>
            </svg>
            <span className="truncate">Sign in with Google</span>
          </button>

          <button 
            onClick={onEmailAuth}
            className="w-full flex items-center justify-center gap-2 bg-[var(--accent)] text-white text-[11px] font-semibold py-2 rounded hover:brightness-110 cursor-pointer transition-all shadow-md shadow-[var(--accent)]/10"
          >
            <Mail size={13} className="shrink-0" />
            <span className="truncate">Sign in with Email</span>
          </button>
        </div>
      )}
    </aside>
  );
}

