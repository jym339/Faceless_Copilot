import { useState } from 'react';
import { Channel } from '../types';

interface WatchlistProps {
  channels: Channel[];
  onAddChannel: (identifier: string) => void;
  onRefreshAll: () => void;
}

export default function Watchlist({ channels, onAddChannel, onRefreshAll }: WatchlistProps) {
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!identifier) return;
    setLoading(true);
    await onAddChannel(identifier);
    setIdentifier('');
    setLoading(false);
  };

  return (
    <aside className="watchlist w-[260px] p-6 flex flex-col h-screen shrink-0 border-l border-[var(--line)]">
      <div className="panel-title text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-4 flex justify-between">
        <span>Watchlist</span>
        <span>{channels.length} TOTAL</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {channels.map((ch) => (
          <div key={ch.id} className="channel-row flex items-center gap-3 py-2.5">
            <img src={ch.avatar_url} alt={ch.title} className="w-8 h-8 rounded-full bg-[#1e293b] object-cover" />
            <div className="ch-info flex-1 overflow-hidden">
              <div className="ch-name text-[0.85rem] font-semibold truncate">{ch.title}</div>
              <div className="ch-stats text-[0.7rem] text-[var(--muted)]">
                Avg: {ch.avg_views_longform > 1000 ? (ch.avg_views_longform / 1000).toFixed(1) + 'K' : ch.avg_views_longform} • {(ch.subscriber_count / 1000).toFixed(1)}K subs
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <input 
          type="text" 
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="@handle or URL"
          className="bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)] p-2 rounded text-sm w-full outline-none focus:border-[var(--accent)]"
        />
        <button 
          onClick={handleAdd}
          disabled={loading}
          className="bg-[var(--accent)] text-white p-2 rounded font-semibold cursor-pointer disabled:opacity-50"
        >
          {loading ? 'Adding...' : '+ Add Channel'}
        </button>
        <button 
          onClick={onRefreshAll}
          className="bg-[var(--card-bg)] border border-[var(--line)] text-[var(--muted)] p-2 rounded font-semibold cursor-pointer hover:bg-[#1e293b]"
        >
          Fetch Latest Data
        </button>
      </div>
    </aside>
  );
}
