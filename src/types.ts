export interface Idea {
  id: string;
  title: string;
  order: number;
}

export interface Entry {
  id: string;
  ideaId: string;
  content: string;
  image?: string | null;
  createdAt: number;
}
