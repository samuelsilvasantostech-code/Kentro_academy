import * as sb from "../supabase/aluno/news";
import * as pg from "../pg/aluno";
import { pick } from "../pg/sql";
import type { NewsItem } from "./types";

const { loadPublishedNews } = pick(sb, pg);

export const getPublishedNews = (limit: number): Promise<NewsItem[]> => loadPublishedNews(limit);
