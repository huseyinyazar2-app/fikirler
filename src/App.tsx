import React, { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { useReactToPrint } from 'react-to-print';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Menu, Plus, Trash2, Edit2, Download, X, GripVertical, Check, Image as ImageIcon, LogOut } from 'lucide-react';

import { Idea, Entry } from './types';

// Sürüklenebilir Liste Elemanı
const SortableIdeaItem: React.FC<{ idea: Idea, isSelected: boolean, onClick: () => void, onDelete: (e: React.MouseEvent) => void | Promise<void> }> = ({ idea, isSelected, onClick, onDelete }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: idea.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between p-3 mb-2 rounded-lg cursor-pointer group ${
        isSelected ? 'bg-blue-100 text-blue-900' : 'hover:bg-gray-100'
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 overflow-hidden">
        <div {...attributes} {...listeners} className="cursor-grab text-gray-400 hover:text-gray-600 touch-none">
          <GripVertical size={16} />
        </div>
        <span className="truncate text-sm font-medium">{idea.title}</span>
      </div>
      <button
        onClick={onDelete}
        className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Fikri Sil"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

export default function App() {
  // Auth State
  const [user, setUser] = useState<{id: string, username: string} | null>(null);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // State
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [selectedIdeaId, setSelectedIdeaId] = useState<string | null>(null);
  
  // Girdiler
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [imageFile, setImageFile] = useState<string | null>(null);
  
  // Düzenleme
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitleValue, setEditingTitleValue] = useState('');

  // Arayüz Durumu
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Referanslar
  const printRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sürükle-Bırak Sensörleri
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Check local storage for user session on load
  useEffect(() => {
    const savedUser = localStorage.getItem('fikirler_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  // Fetch Ideas
  useEffect(() => {
    if (user) {
      fetch(`/api/ideas?userId=${user.id}`)
        .then(res => res.json())
        .then(data => {
          setIdeas(data.map((d: any) => ({ id: d.id, title: d.title, order: d.order_num })));
        })
        .catch(err => console.error("Fikirler yüklenemedi:", err));
    }
  }, [user]);

  // Fetch Entries when Idea is selected
  useEffect(() => {
    if (selectedIdeaId) {
      fetch(`/api/entries?ideaId=${selectedIdeaId}`)
        .then(res => res.json())
        .then(data => {
          setEntries(data.map((d: any) => ({ 
            id: d.id, 
            ideaId: d.idea_id, 
            content: d.content, 
            image: d.image,
            createdAt: d.created_at 
          })));
        })
        .catch(err => console.error("İçerikler yüklenemedi:", err));
    } else {
      setEntries([]);
    }
  }, [selectedIdeaId]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });
      const data = await res.json();
      if (data.success) {
        const userData = { id: data.userId, username: loginUsername };
        setUser(userData);
        localStorage.setItem('fikirler_user', JSON.stringify(userData));
      } else {
        setLoginError(data.error || 'Giriş başarısız');
      }
    } catch (err) {
      setLoginError('Sunucuya bağlanılamadı');
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('fikirler_user');
    setIdeas([]);
    setEntries([]);
    setSelectedIdeaId(null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setIdeas((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex) as Idea[];
        const updatedItems = newItems.map((item, index) => ({ ...item, order: index }));
        
        // Veritabanını güncelle
        fetch('/api/ideas/order', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates: updatedItems.map(i => ({ id: i.id, orderNum: i.order })) })
        }).catch(err => console.error("Sıralama kaydedilemedi:", err));

        return updatedItems;
      });
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageFile(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!newContent.trim() && !imageFile) return;

    if (!selectedIdeaId) {
      if (!newTitle.trim()) {
        alert("Lütfen bir başlık girin.");
        return;
      }
      const newIdea: Idea = {
        id: uuidv4(),
        title: newTitle.trim(),
        order: ideas.length,
      };
      
      await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: newIdea.id, userId: user!.id, title: newIdea.title, orderNum: newIdea.order })
      });
      setIdeas([...ideas, newIdea]);

      const newEntry: Entry = {
        id: uuidv4(),
        ideaId: newIdea.id,
        content: newContent.trim(),
        image: imageFile,
        createdAt: Date.now(),
      };
      
      await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEntry)
      });

      setSelectedIdeaId(newIdea.id);
      setEntries([newEntry]);
      setNewTitle('');
      setNewContent('');
      setImageFile(null);
    } else {
      const newEntry: Entry = {
        id: uuidv4(),
        ideaId: selectedIdeaId,
        content: newContent.trim(),
        image: imageFile,
        createdAt: Date.now(),
      };
      
      await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEntry)
      });
      
      setEntries([newEntry, ...entries]);
      setNewContent('');
      setImageFile(null);
    }
  };

  const handleDeleteIdea = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Bu fikri ve tüm içeriğini silmek istediğinize emin misiniz?')) {
      await fetch(`/api/ideas/${id}`, { method: 'DELETE' });
      setIdeas(ideas.filter(i => i.id !== id));
      if (selectedIdeaId === id) {
        setSelectedIdeaId(null);
        setEntries([]);
      }
    }
  };

  const handleDeleteEntry = async (id: string) => {
    if (confirm('Bu mesajı silmek istediğinize emin misiniz?')) {
      await fetch(`/api/entries/${id}`, { method: 'DELETE' });
      setEntries(entries.filter(e => e.id !== id));
    }
  };

  const handleEditEntry = (entry: Entry) => {
    setEditingEntryId(entry.id);
    setEditingContent(entry.content);
  };

  const handleSaveEdit = async () => {
    await fetch(`/api/entries/${editingEntryId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: editingContent })
    });
    setEntries(entries.map(e => e.id === editingEntryId ? { ...e, content: editingContent } : e));
    setEditingEntryId(null);
    setEditingContent('');
  };

  const handleSaveTitle = async () => {
    if (!editingTitleValue.trim() || !selectedIdeaId) return;
    try {
      await fetch(`/api/ideas/${selectedIdeaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editingTitleValue.trim() })
      });
      setIdeas(ideas.map(i => i.id === selectedIdeaId ? { ...i, title: editingTitleValue.trim() } : i));
      setIsEditingTitle(false);
    } catch (err) {
      console.error("Başlık güncellenemedi:", err);
    }
  };

  const handleDownloadPdf = useReactToPrint({
    content: () => printRef.current,
    documentTitle: ideas.find(i => i.id === selectedIdeaId)?.title || 'Fikirler',
  });

  if (!user) {
    return (
      <div className="flex items-center justify-center h-[100dvh] bg-gray-50 font-sans text-gray-900">
        <form onSubmit={handleLogin} className="bg-white p-8 rounded-xl shadow-md w-full max-w-sm">
          <h1 className="text-2xl font-bold text-center mb-6">Fikirler'e Giriş</h1>
          {loginError && <p className="text-red-500 text-sm mb-4 text-center">{loginError}</p>}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Kullanıcı Adı</label>
            <input 
              type="text" 
              required
              value={loginUsername}
              onChange={e => setLoginUsername(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Şifre</label>
            <input 
              type="text" 
              required
              value={loginPassword}
              onChange={e => setLoginPassword(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors">
            Giriş Yap / Kayıt Ol
          </button>
        </form>
      </div>
    );
  }

  const selectedIdea = ideas.find(i => i.id === selectedIdeaId);

  return (
    <div className="flex h-[100dvh] bg-gray-50 font-sans text-gray-900 overflow-hidden">
      {/* Mobil Menü Arka Planı */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sol Menü (Sidebar) */}
      <div className={`
        fixed inset-y-0 left-0 z-30 w-72 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out flex flex-col
        md:relative md:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800">Fikirler</h1>
          <div className="flex items-center gap-2">
            <button onClick={handleLogout} className="text-gray-500 hover:text-red-500 p-1" title="Çıkış Yap">
              <LogOut size={20} />
            </button>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-gray-500 p-1">
              <X size={24} />
            </button>
          </div>
        </div>
        
        <div className="p-4">
          <button 
            onClick={() => {
              setSelectedIdeaId(null);
              setNewTitle('');
              setNewContent('');
              setImageFile(null);
              setIsSidebarOpen(false);
            }}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors"
          >
            <Plus size={20} />
            <span>Yeni Fikir</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 pt-0">
          <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext 
              items={ideas.map(i => i.id)}
              strategy={verticalListSortingStrategy}
            >
              {ideas.sort((a, b) => a.order - b.order).map(idea => (
                <SortableIdeaItem
                  key={idea.id}
                  idea={idea}
                  isSelected={selectedIdeaId === idea.id}
                  onClick={() => {
                    setSelectedIdeaId(idea.id);
                    setIsSidebarOpen(false);
                  }}
                  onDelete={(e) => handleDeleteIdea(e, idea.id)}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      </div>

      {/* Ana İçerik Alanı */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Üst Bilgi Çubuğu */}
        <header className="bg-white border-b border-gray-200 p-4 flex items-center justify-between shadow-sm z-10 shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden text-gray-500 hover:text-gray-700 shrink-0">
              <Menu size={24} />
            </button>
            <h2 className="text-lg font-semibold truncate">
              {selectedIdea ? selectedIdea.title : 'Yeni Fikir Oluştur'}
            </h2>
          </div>
          {selectedIdea && (
            <button 
              onClick={() => handleDownloadPdf()}
              className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors shrink-0 print:hidden"
              title="Yazdır / PDF Olarak Kaydet"
            >
              <Download size={20} />
              <span className="hidden sm:inline">PDF İndir</span>
            </button>
          )}
        </header>

        {/* Sohbet (İçerik) Alanı */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50">
          {selectedIdea ? (
            <div ref={printRef} className="flex flex-col w-full max-w-3xl mx-auto p-4 bg-gray-50 min-h-full">
              <div className="mb-6 border-b pb-4 mt-4 shrink-0 group/title">
                {isEditingTitle ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editingTitleValue}
                      onChange={(e) => setEditingTitleValue(e.target.value)}
                      className="text-3xl font-bold border-b-2 border-blue-500 focus:outline-none bg-transparent w-full"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveTitle();
                        if (e.key === 'Escape') setIsEditingTitle(false);
                      }}
                    />
                    <button onClick={handleSaveTitle} className="text-green-600 hover:text-green-700 p-1"><Check size={24} /></button>
                    <button onClick={() => setIsEditingTitle(false)} className="text-gray-400 hover:text-gray-600 p-1"><X size={24} /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-bold">{selectedIdea.title}</h1>
                    <button
                      onClick={() => {
                        setEditingTitleValue(selectedIdea.title);
                        setIsEditingTitle(true);
                      }}
                      className="text-gray-400 hover:text-blue-500 opacity-0 group-hover/title:opacity-100 transition-opacity print:hidden"
                    >
                      <Edit2 size={20} />
                    </button>
                  </div>
                )}
                <p className="text-gray-500 mt-2">Oluşturulma: {format(new Date(), 'dd.MM.yyyy HH:mm')}</p>
              </div>
              
              <div className="flex flex-col-reverse gap-4 flex-1">
              {entries.map(entry => (
                <div key={entry.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 group">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs text-gray-400 font-medium">
                      {format(entry.createdAt, 'dd.MM.yyyy HH:mm')}
                    </span>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
                      <button onClick={() => handleEditEntry(entry)} className="text-gray-400 hover:text-blue-500" title="Düzenle">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDeleteEntry(entry.id)} className="text-gray-400 hover:text-red-500" title="Sil">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  
                  {editingEntryId === entry.id ? (
                    <div className="flex flex-col gap-2">
                      <textarea
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none min-h-[100px]"
                      />
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setEditingEntryId(null)} className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded">İptal</button>
                        <button onClick={handleSaveEdit} className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1">
                          <Check size={16} /> Kaydet
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {entry.image && (
                        <img src={entry.image} alt="Eklenen görsel" className="max-w-full rounded-lg max-h-96 object-contain" />
                      )}
                      {entry.content && (
                        <div className="whitespace-pre-wrap text-gray-800 leading-relaxed">
                          {entry.content}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              </div>
              {entries.length === 0 && (
                <div className="text-center text-gray-400 my-10">Henüz bir içerik eklenmemiş.</div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 flex-col gap-4">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-500">
                <Plus size={32} />
              </div>
              <p className="text-center px-4">Sol menüden bir fikir seçin veya yeni bir tane oluşturun.</p>
            </div>
          )}
        </div>

        {/* Girdi (Input) Alanı */}
        <div className="bg-white border-t border-gray-200 p-4 shrink-0">
          <div className="max-w-3xl mx-auto flex flex-col gap-3">
            {!selectedIdeaId && (
              <input
                type="text"
                placeholder="Fikir Başlığı..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
              />
            )}
            
            {imageFile && (
              <div className="relative inline-block w-max">
                <img src={imageFile} alt="Önizleme" className="h-20 rounded-md border border-gray-200" />
                <button 
                  onClick={() => setImageFile(null)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            <div className="relative flex items-end gap-2">
              <div className="flex-1 relative">
                <textarea
                  placeholder={selectedIdeaId ? "Bu fikre yeni bir detay ekle..." : "Fikrinizin açıklamasını yazın..."}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSave();
                    }
                  }}
                  className="w-full p-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none min-h-[80px] max-h-48"
                  rows={3}
                />
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-3 right-3 text-gray-400 hover:text-blue-500 transition-colors"
                  title="Resim Ekle"
                >
                  <ImageIcon size={24} />
                </button>
              </div>
              <button
                onClick={handleSave}
                disabled={(!newContent.trim() && !imageFile) || (!selectedIdeaId && !newTitle.trim())}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition-colors h-[80px]"
              >
                Kaydet
              </button>
            </div>
            <p className="text-xs text-gray-400 text-center">
              Kaydetmek için Enter'a basabilirsiniz. Alt satıra geçmek için Shift + Enter kullanın.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
