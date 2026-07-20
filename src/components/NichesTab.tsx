import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Hash, BookOpen } from 'lucide-react';

interface Niche {
  id: string;
  name: string;
  keywords: string[];
}

export default function NichesTab() {
  const [niches, setNiches] = useState<Niche[]>([]);
  const [name, setName] = useState('');
  const [keywordsStr, setKeywordsStr] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchNiches = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('oauth_token');
      const res = await fetch('/api/niches', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setNiches(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNiches();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    const keywords = keywordsStr
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    try {
      const token = localStorage.getItem('oauth_token');
      const res = await fetch('/api/niches', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ name: name.trim(), keywords }),
      });
      if (res.ok) {
        setName('');
        setKeywordsStr('');
        fetchNiches();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const token = localStorage.getItem('oauth_token');
      const res = await fetch(`/api/niches/${id}`, { 
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.ok) {
        fetchNiches();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-[#05070a]">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Niche setup</h1>
        <p className="text-[0.8rem] text-[var(--muted)] mt-1">
          Configure different niches you monitor. You can define target keywords that the discovery engine can search for.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Creation Form */}
        <div className="lg:col-span-1 bg-[var(--card-bg)] border border-[var(--line)] rounded-xl p-5 h-fit">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--muted)] mb-4 flex items-center gap-2">
            <Plus size={14} className="text-[var(--accent)]" /> Create Niche Topic
          </h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs text-[var(--muted)] font-semibold mb-1.5">Niche Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. WWII Military History"
                className="w-full bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)] px-3 py-2 rounded text-sm outline-none focus:border-[var(--accent)]"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-[var(--muted)] font-semibold mb-1.5">Search Keywords (comma separated)</label>
              <textarea
                value={keywordsStr}
                onChange={(e) => setKeywordsStr(e.target.value)}
                placeholder="WWII documentary, military history, tank battles, general patton"
                rows={3}
                className="w-full bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)] px-3 py-2 rounded text-sm outline-none focus:border-[var(--accent)] resize-none"
              />
              <p className="text-[0.65rem] text-[var(--muted)] mt-1 font-mono leading-relaxed">
                The research engine runs keyword scouting against these phrases to catch fresh uploads.
              </p>
            </div>

            <button
              type="submit"
              className="w-full bg-[var(--accent)] text-white font-semibold py-2 rounded text-sm cursor-pointer hover:opacity-90 transition-all"
            >
              Add Niche Topic
            </button>
          </form>
        </div>

        {/* List of Niches */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--muted)] flex items-center gap-2 mb-4">
            <BookOpen size={14} className="text-[var(--accent)]" /> Configured Niche Topics ({niches.length})
          </h2>

          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-[var(--line)] border-t-[var(--accent)] rounded-full animate-spin"></div>
            </div>
          ) : niches.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {niches.map((n) => (
                <div key={n.id} className="bg-[var(--card-bg)] border border-[var(--line)] rounded-xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold text-sm text-[var(--ink)] truncate max-w-[80%]">{n.name}</h3>
                      <button
                        onClick={() => handleDelete(n.id)}
                        className="text-[var(--muted)] hover:text-red-400 p-1 rounded hover:bg-red-950/20 transition-all cursor-pointer"
                        title="Delete Niche"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div className="mt-3 space-y-1">
                      <div className="text-[0.7rem] text-[var(--muted)] font-mono font-semibold uppercase tracking-wider">Scouting Phrases:</div>
                      {n.keywords.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {n.keywords.map((k, idx) => (
                            <span key={idx} className="bg-[var(--bg)] border border-[var(--line)] text-[var(--muted)] text-[0.7rem] px-2 py-0.5 rounded-md font-mono flex items-center gap-1">
                              <Hash size={10} className="text-[var(--accent)]" /> {k}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-[var(--muted)] italic">No keywords specified</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 border border-dashed border-[var(--line)] rounded-xl">
              <p className="text-xs text-[var(--muted)] font-mono">No niche topics created yet. Set up your first topic area using the form.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
