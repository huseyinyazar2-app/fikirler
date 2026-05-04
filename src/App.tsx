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
import { Menu, Plus, Trash2, Edit2, Download, X, GripVertical, Check, Image as ImageIcon, LogOut, ChevronDown, ChevronRight, FolderPlus, Folder } from 'lucide-react';

import { Idea, Entry, Category } from './types';

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
      className={`flex items-center justify-between p-2 mb-1 rounded-md cursor-pointer group ${
        isSelected ? 'bg-purple-100 text-purple-900' : 'hover:bg-gray-100'
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
  const [categories, setCategories] = useState<Category[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [selectedIdeaId, setSelectedIdeaId] = useState<string | null>(null);
  
  // Category states
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');

  // Sidebar Resize
  const [sidebarWidth, setSidebarWidth] = useState(288);
  const isResizing = useRef(false);

  const startResizing = React.useCallback((mouseDownEvent: React.MouseEvent) => {
    isResizing.current = true;
    const startWidth = sidebarWidth;
    const startX = mouseDownEvent.clientX;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    const onMouseMove = (mouseMoveEvent: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = startWidth + mouseMoveEvent.clientX - startX;
      setSidebarWidth(Math.max(200, Math.min(newWidth, 600)));
    };

    const onMouseUp = () => {
      isResizing.current = false;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [sidebarWidth]);

  // Girdiler
  const [newTitle, setNewTitle] = useState('');
  const [creatingForCategoryId, setCreatingForCategoryId] = useState<string | null>(null);
  const [newContent, setNewContent] = useState('');
  const [imageFile, setImageFile] = useState<string | null>(null);
  
  // Düzenleme
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitleValue, setEditingTitleValue] = useState('');

  // Arayüz Durumu
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Modal States
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
    onConfirm: () => void;
  } | null>(null);

  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  } | null>(null);

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
      fetch(`/api/categories?userId=${user.id}`)
        .then(res => res.json())
        .then(data => {
          setCategories(data.map((d: any) => ({ id: d.id, name: d.name, order: d.order_num })));
        })
        .catch(err => console.error("Kategoriler yüklenemedi:", err));

      fetch(`/api/ideas?userId=${user.id}`)
        .then(res => res.json())
        .then(data => {
          setIdeas(data.map((d: any) => ({ id: d.id, title: d.title, order: d.order_num, categoryId: d.category_id })));
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
        const activeIdea = items.find(i => i.id === active.id);
        const overIdea = items.find(i => i.id === over.id);
        
        if (!activeIdea || !overIdea) return items;

        const isChangingCategory = activeIdea.categoryId !== overIdea.categoryId;
        if (isChangingCategory) {
          activeIdea.categoryId = overIdea.categoryId;
        }

        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex) as Idea[];
        
        // Sadece etkilenen kategorideki öğelerin sırasını güncelle
        const targetCategoryIdeas = newItems.filter(i => i.categoryId === overIdea.categoryId);
        const updatedItems = targetCategoryIdeas.map((item, index) => ({ ...item, order: index }));
        
        // Veritabanını güncelle
        fetch('/api/ideas/order', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates: updatedItems.map(i => ({ id: i.id, orderNum: i.order })) })
        }).catch(err => console.error("Sıralama kaydedilemedi:", err));

        if (isChangingCategory) {
          fetch(`/api/ideas/${activeIdea.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category_id: overIdea.categoryId })
          });
        }

        return newItems.map(i => {
           const updated = updatedItems.find(u => u.id === i.id);
           return updated ? updated : i;
        });
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
        categoryId: creatingForCategoryId || null,
      };
      
      await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: newIdea.id, userId: user!.id, title: newIdea.title, orderNum: newIdea.order, categoryId: newIdea.categoryId })
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
      setCreatingForCategoryId(null);
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
    setConfirmModal({
      isOpen: true,
      title: 'Fikri Sil',
      message: 'Bu fikri ve tüm içeriğini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.',
      confirmText: 'Evet, Sil',
      cancelText: 'İptal',
      isDanger: true,
      onConfirm: async () => {
        await fetch(`/api/ideas/${id}`, { method: 'DELETE' });
        setIdeas(ideas.filter(i => i.id !== id));
        if (selectedIdeaId === id) {
          setSelectedIdeaId(null);
          setEntries([]);
        }
        setConfirmModal(null);
      }
    });
  };

  const handleDeleteEntry = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Girdiyi Sil',
      message: 'Bu girdiyi silmek istediğinize emin misiniz?',
      confirmText: 'Sil',
      cancelText: 'İptal',
      isDanger: true,
      onConfirm: async () => {
        await fetch(`/api/entries/${id}`, { method: 'DELETE' });
        setEntries(entries.filter(e => e.id !== id));
        setConfirmModal(null);
      }
    });
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

  const handleCreateCategoryInline = async () => {
    if (!newCategoryName.trim() || !user) return;
    const newCategory: Category = {
      id: uuidv4(),
      name: newCategoryName.trim(),
      order: categories.length
    };
    await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: newCategory.id, userId: user.id, name: newCategory.name, orderNum: newCategory.order })
    });
    setCategories([...categories, newCategory]);
    setExpandedCategories(prev => ({...prev, [newCategory.id]: true}));
    
    if (selectedIdeaId) {
      handleUpdateIdeaCategory(selectedIdeaId, newCategory.id);
    } else {
      setCreatingForCategoryId(newCategory.id);
    }
    
    setIsAddingCategory(false);
    setNewCategoryName('');
  };

  const handleUpdateIdeaCategory = async (ideaId: string, newCategoryId: string | null) => {
    try {
      await fetch(`/api/ideas/${ideaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category_id: newCategoryId })
      });
      setIdeas(ideas.map(i => i.id === ideaId ? { ...i, categoryId: newCategoryId } : i));
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateCategory = async () => {
    if (!editingCategoryName.trim() || !editingCategoryId) return;
    try {
      await fetch(`/api/categories/${editingCategoryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingCategoryName.trim() })
      });
      setCategories(categories.map(c => c.id === editingCategoryId ? { ...c, name: editingCategoryName.trim() } : c));
      setEditingCategoryId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteCategory = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const hasIdeas = ideas.some(i => i.categoryId === id);
    if (hasIdeas) {
      setAlertModal({
        isOpen: true,
        title: 'Hata',
        message: 'Bu kategori boş değil. Lütfen önce içindeki fikirleri silin veya başka bir kategoriye taşıyın.'
      });
      return;
    }
    
    setConfirmModal({
      isOpen: true,
      title: 'Kategoriyi Sil',
      message: 'Bu kategoriyi silmek istediğinize emin misiniz?',
      confirmText: 'Kategoriyi Sil',
      cancelText: 'İptal',
      isDanger: true,
      onConfirm: async () => {
        await fetch(`/api/categories/${id}`, { method: 'DELETE' });
        setCategories(categories.filter(c => c.id !== id));
        setIdeas(ideas.map(i => i.categoryId === id ? { ...i, categoryId: null } : i));
        setConfirmModal(null);
      }
    });
  };

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
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
            />
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Şifre</label>
            <input 
              type="text" 
              required
              value={loginPassword}
              onChange={e => setLoginPassword(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
            />
          </div>
          <button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-md transition-colors">
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
      <div 
        className={`fixed inset-y-0 left-0 z-30 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out flex flex-col pt-0 shrink-0
        md:relative md:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ width: `${sidebarWidth}px` }}
      >
        <div className="p-4 border-b border-gray-200 flex items-center justify-between shrink-0">
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
        
        <div className="p-4 shrink-0 flex flex-col gap-2">
          <button 
            onClick={() => {
              setSelectedIdeaId(null);
              setNewTitle('');
              setNewContent('');
              setImageFile(null);
              setCreatingForCategoryId(null);
              setIsSidebarOpen(false);
            }}
            className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg transition-colors"
          >
            <Plus size={20} />
            <span>Yeni Fikir</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 select-none">
          <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            {/* Kategorize Edilmemişler (Genel) */}
            <div className="mb-4">
              <div 
                className="flex items-center gap-1 text-gray-500 font-semibold text-sm mb-2 cursor-pointer hover:text-gray-700" 
                onClick={() => setExpandedCategories(p => ({...p, 'genel': p['genel'] !== false ? false : true}))}
              >
                {expandedCategories['genel'] === false ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                <span>Genel</span>
              </div>
              {expandedCategories['genel'] !== false && (
                <SortableContext items={ideas.filter(i => i.categoryId === null).map(i => i.id)} strategy={verticalListSortingStrategy}>
                  <div className="pl-2 border-l border-gray-100 ml-2">
                    {ideas.filter(i => i.categoryId === null).sort((a,b) => a.order - b.order).map(idea => (
                      <SortableIdeaItem key={idea.id} idea={idea} isSelected={selectedIdeaId === idea.id} onClick={() => { setSelectedIdeaId(idea.id); setIsSidebarOpen(false); }} onDelete={(e) => handleDeleteIdea(e, idea.id)} />
                    ))}
                    {ideas.filter(i => i.categoryId === null).length === 0 && <p className="text-xs text-gray-400 py-2 italic pl-2">Boş</p>}
                  </div>
                </SortableContext>
              )}
            </div>

            {/* Kategoriler */}
            {categories.sort((a,b) => a.order - b.order).map(cat => {
              const isExpanded = expandedCategories[cat.id] === undefined ? true : expandedCategories[cat.id];
              return (
              <div key={cat.id} className="mb-4">
                <div className="flex items-center justify-between group mb-2">
                  {editingCategoryId === cat.id ? (
                    <div className="flex items-center gap-1 flex-1">
                      <input type="text" autoFocus value={editingCategoryName} onChange={(e) => setEditingCategoryName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateCategory(); if (e.key === 'Escape') setEditingCategoryId(null); }} className="w-full text-sm font-semibold border-b border-purple-400 focus:outline-none" />
                      <button onClick={handleUpdateCategory} className="text-green-600"><Check size={16} /></button>
                      <button onClick={() => setEditingCategoryId(null)} className="text-gray-400"><X size={16} /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 cursor-pointer flex-1 text-gray-600 hover:text-gray-900 overflow-hidden" onClick={() => setExpandedCategories(p => ({...p, [cat.id]: !isExpanded}))}>
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      <span className="font-semibold text-sm truncate" onClick={(e) => { if(e.detail === 2) { setEditingCategoryId(cat.id); setEditingCategoryName(cat.name); }}}>{cat.name}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setSelectedIdeaId(null); setCreatingForCategoryId(cat.id); }} className="text-gray-400 hover:text-purple-600 p-1" title="Bu kategoriye fikir ekle"><Plus size={14}/></button>
                    <button onClick={() => { setEditingCategoryId(cat.id); setEditingCategoryName(cat.name); }} className="text-gray-400 hover:text-purple-500 p-1" title="Kategoriyi düzenle"><Edit2 size={14} /></button>
                    <button onClick={(e) => handleDeleteCategory(e, cat.id)} className="text-gray-400 hover:text-red-500 p-1" title="Kategoriyi sil"><Trash2 size={14} /></button>
                  </div>
                </div>
                {isExpanded && (
                  <SortableContext items={ideas.filter(i => i.categoryId === cat.id).map(i => i.id)} strategy={verticalListSortingStrategy}>
                    <div className="pl-2 border-l border-indigo-100 ml-2">
                      {ideas.filter(i => i.categoryId === cat.id).sort((a,b) => a.order - b.order).map(idea => (
                        <SortableIdeaItem key={idea.id} idea={idea} isSelected={selectedIdeaId === idea.id} onClick={() => { setSelectedIdeaId(idea.id); setIsSidebarOpen(false); }} onDelete={(e) => handleDeleteIdea(e, idea.id)} />
                      ))}
                      {ideas.filter(i => i.categoryId === cat.id).length === 0 && <p className="text-xs text-gray-400 py-2 italic pl-2">Boş</p>}
                    </div>
                  </SortableContext>
                )}
              </div>
            )})}
          </DndContext>
        </div>

        {/* Resizer Handle */}
        <div 
          onMouseDown={startResizing}
          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-purple-400 active:bg-purple-600 transition-colors z-40 hidden md:block"
        />
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
              className="flex items-center gap-2 text-gray-600 hover:text-purple-600 transition-colors shrink-0 print:hidden"
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
                <div className="mb-3 flex flex-wrap items-center gap-2 print:hidden">
                  <span className="text-gray-500 text-sm font-medium">Kategori: </span>
                  <select 
                    value={selectedIdea.categoryId || ''}
                    onChange={(e) => {
                      if (e.target.value === 'NEW') {
                        setIsAddingCategory(true);
                      } else {
                        handleUpdateIdeaCategory(selectedIdea.id, e.target.value || null);
                        setIsAddingCategory(false);
                      }
                    }}
                    className="py-1 px-2 border border-gray-200 rounded text-sm font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 focus:outline-none transition-colors cursor-pointer"
                  >
                    <option value="">Genel</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    <option value="NEW">+ Yeni Kategori Ekle</option>
                  </select>
                  
                  {isAddingCategory && selectedIdeaId && (
                    <div className="flex items-center gap-2 ml-2">
                      <input 
                        type="text" 
                        value={newCategoryName} 
                        onChange={e => setNewCategoryName(e.target.value)} 
                        placeholder="Kategori Adı" 
                        className="p-1 px-2 border border-purple-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 w-40"
                        autoFocus
                        onKeyDown={(e) => { if (e.key === 'Enter') handleCreateCategoryInline(); }}
                      />
                      <button onClick={handleCreateCategoryInline} className="text-white bg-green-500 hover:bg-green-600 rounded p-1.5"><Check size={14} /></button>
                      <button onClick={() => setIsAddingCategory(false)} className="text-gray-500 hover:bg-gray-200 rounded p-1.5"><X size={14} /></button>
                    </div>
                  )}
                </div>
                {isEditingTitle ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editingTitleValue}
                      onChange={(e) => setEditingTitleValue(e.target.value)}
                      className="text-3xl font-bold border-b-2 border-purple-500 focus:outline-none bg-transparent w-full"
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
                      className="text-gray-400 hover:text-purple-500 opacity-0 group-hover/title:opacity-100 transition-opacity print:hidden"
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
                      <button onClick={() => handleEditEntry(entry)} className="text-gray-400 hover:text-purple-500" title="Düzenle">
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
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none min-h-[100px]"
                      />
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setEditingEntryId(null)} className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded">İptal</button>
                        <button onClick={handleSaveEdit} className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 flex items-center gap-1">
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
              <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center text-purple-500">
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
              <div className="flex flex-col gap-2 mb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-gray-500 text-sm font-medium">Kategori: </span>
                  <select 
                    value={creatingForCategoryId || ''}
                    onChange={(e) => {
                      if (e.target.value === 'NEW') {
                        setIsAddingCategory(true);
                      } else {
                        setCreatingForCategoryId(e.target.value || null);
                        setIsAddingCategory(false);
                      }
                    }}
                    className="py-1.5 px-3 border border-gray-300 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-purple-500 bg-white"
                  >
                    <option value="">Genel (Kategorisiz)</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    <option value="NEW">+ Yeni Kategori Ekle</option>
                  </select>
                  
                  {isAddingCategory && !selectedIdeaId && (
                    <div className="flex items-center gap-2">
                      <input 
                        type="text" 
                        value={newCategoryName} 
                        onChange={e => setNewCategoryName(e.target.value)} 
                        placeholder="Yeni Kategori Adı" 
                        className="p-1.5 px-3 border border-purple-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                        autoFocus
                        onKeyDown={(e) => { if (e.key === 'Enter') handleCreateCategoryInline(); }}
                      />
                      <button onClick={handleCreateCategoryInline} className="bg-green-500 text-white p-2 rounded-lg hover:bg-green-600"><Check size={16} /></button>
                      <button onClick={() => setIsAddingCategory(false)} className="bg-gray-200 text-gray-600 p-2 rounded-lg hover:bg-gray-300"><X size={16} /></button>
                    </div>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Fikir Başlığı..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-medium"
                />
              </div>
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
                  className="w-full p-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none min-h-[80px] max-h-48"
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
                  className="absolute bottom-3 right-3 text-gray-400 hover:text-purple-500 transition-colors"
                  title="Resim Ekle"
                >
                  <ImageIcon size={24} />
                </button>
              </div>
              <button
                onClick={handleSave}
                disabled={(!newContent.trim() && !imageFile) || (!selectedIdeaId && !newTitle.trim())}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition-colors h-[80px]"
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

      {/* Confirm Modal */}
      {confirmModal && confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-2">{confirmModal.title}</h3>
              <p className="text-gray-600 mb-6">{confirmModal.message}</p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setConfirmModal(null)}
                  className="px-4 py-2 font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  {confirmModal.cancelText || 'İptal'}
                </button>
                <button
                  onClick={confirmModal.onConfirm}
                  className={`px-4 py-2 font-medium text-white rounded-lg transition-colors ${
                    confirmModal.isDanger 
                      ? 'bg-red-600 hover:bg-red-700' 
                      : 'bg-purple-600 hover:bg-purple-700'
                  }`}
                >
                  {confirmModal.confirmText || 'Onayla'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alert Modal */}
      {alertModal && alertModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-2">{alertModal.title}</h3>
              <p className="text-gray-600 mb-6">{alertModal.message}</p>
              <div className="flex justify-end">
                <button
                  onClick={() => setAlertModal(null)}
                  className="px-4 py-2 font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
                >
                  Tamam
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
