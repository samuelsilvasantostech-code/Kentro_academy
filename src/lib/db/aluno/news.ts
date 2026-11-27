import { loadPublishedNews } from "../supabase/aluno/news";
import type { NewsItem } from "./types";

export const getPublishedNews = (limit: number): Promise<NewsItem[]> => loadPublishedNews(limit);
