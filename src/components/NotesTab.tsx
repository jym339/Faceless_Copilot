import React, { useState, useEffect } from 'react';
import { Plus, Trash2, FileText, CheckCircle, Save } from 'lucide-react';

interface Note {
  id: string;
  title: string;
  content: string;
  updated_at: string;
}

export default function NotesTab() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [savedStatus, setSavedStatus] = useState('');

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('oauth_token');
      const res = await fetch('/api/notes', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setNotes(data);
        if (data.length > 0 && !selectedNote) {
          handleSelectNote(data[0]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  const handleSelectNote = (note: Note) => {
    setSelectedNote(note);
    setTitle(note.title);
    setContent(note.content);
    setSavedStatus('');
  };

  const handleCreateNew = () => {
    setSelectedNote(null);
    setTitle('New Outline');
    setContent('');
    setSavedStatus('');
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    try {
      const token = localStorage.getItem('oauth_token');
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          id: selectedNote?.id,
          title: title.trim(),
          content,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSavedStatus('Draft saved successfully!');
        setTimeout(() => setSavedStatus(''), 3000);
        
        // Refresh notes list
        const listRes = await fetch('/api/notes', {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        const listData = await listRes.json();
        if (Array.isArray(listData)) {
          setNotes(listData);
          // Set selection to current or new note
          const updatedNote = listData.find((n: Note) => n.id === data.note.id || n.title === title.trim());
          if (updatedNote) setSelectedNote(updatedNote);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const token = localStorage.getItem('oauth_token');
      const res = await fetch(`/api/notes/${id}`, { 
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.ok) {
        if (selectedNote?.id === id) {
          setSelectedNote(null);
          setTitle('');
          setContent('');
        }
        fetchNotes();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex-1 flex bg-[#05070a] h-screen overflow-hidden">
      {/* Sidebar List */}
      <div className="w-[280px] border-r border-[var(--line)] flex flex-col py-6 px-4 h-full shrink-0">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Outlines & Ideas</h2>
          <button
            onClick={handleCreateNew}
            className="text-xs bg-[var(--accent)] text-white px-2.5 py-1 rounded font-semibold hover:opacity-90 cursor-pointer flex items-center gap-1"
          >
            <Plus size={12} /> New
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-5 h-5 border-2 border-[var(--line)] border-t-[var(--accent)] rounded-full animate-spin"></div>
            </div>
          ) : notes.length > 0 ? (
            notes.map((n) => {
              const isSelected = selectedNote?.id === n.id;
              return (
                <div
                  key={n.id}
                  onClick={() => handleSelectNote(n)}
                  className={`p-3 rounded-lg cursor-pointer transition-all flex items-start gap-2 border ${
                    isSelected
                      ? 'bg-[#1e293b]/50 border-[var(--accent)]'
                      : 'border-transparent hover:bg-slate-900/40 text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  <FileText size={15} className={`mt-0.5 shrink-0 ${isSelected ? 'text-[var(--accent)]' : ''}`} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-xs truncate text-[var(--ink)]">{n.title || 'Untitled'}</div>
                    <div className="text-[0.65rem] text-[var(--muted)] truncate font-mono mt-0.5">
                      {n.content ? n.content.substring(0, 45) : 'Empty note'}
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDelete(n.id, e)}
                    className="text-[var(--muted)] hover:text-red-400 p-0.5 rounded"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })
          ) : (
            <div className="text-center py-10 text-xs text-[var(--muted)] italic">
              No ideas outline saved yet. Click 'New' to start drafting!
            </div>
          )}
        </div>
      </div>

      {/* Main Editor */}
      <div className="flex-1 flex flex-col h-full py-6 px-6">
        <div className="flex justify-between items-center mb-4">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Idea Title..."
            className="bg-transparent text-xl font-bold tracking-tight text-[var(--ink)] border-b border-transparent focus:border-[var(--line)] outline-none w-full max-w-lg pb-1"
          />
          <div className="flex items-center gap-3">
            {savedStatus && (
              <span className="text-emerald-400 text-xs font-mono flex items-center gap-1">
                <CheckCircle size={12} /> {savedStatus}
              </span>
            )}
            <button
              onClick={handleSave}
              className="bg-[var(--accent)] hover:opacity-90 text-white text-xs px-4 py-2 rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Save size={13} /> Save Idea
            </button>
          </div>
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Break down the outlier video's structure here...
  - Hook details: Why did viewers click and watch the first 10 seconds?
  - Core pacing: How does the storytelling progress?
  - Thumbnail description: Study the colors, layout, font, and objects.
  - Script outline draft: Jot down your reverse-engineered version here..."
          className="flex-1 bg-[var(--card-bg)] border border-[var(--line)] text-[var(--ink)] p-4 rounded-xl text-sm outline-none focus:border-[var(--accent)] resize-none font-mono leading-relaxed"
        />
      </div>
    </div>
  );
}
