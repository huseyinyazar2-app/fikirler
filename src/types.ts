export interface Category {
  id: string;
  name: string;
  order: number;
}

export interface Idea {
  id: string;
  title: string;
  order: number;
  categoryId: string | null;
}

export interface Entry {
  id: string;
  ideaId: string;
  content: string;
  image?: string | null;
  createdAt: number;
}
