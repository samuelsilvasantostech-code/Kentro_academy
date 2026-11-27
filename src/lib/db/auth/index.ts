import { isPostgres } from "../backend";
import * as sb from "../supabase/auth";
import * as pg from "../pg/auth";

export * from "./types";

// Escolhe o login pelo DATA_BACKEND: no Doca, login próprio no Postgres; na Vercel, Supabase.
const impl = () => (isPostgres() ? pg : sb);

export const getSessionUser: typeof sb.getSessionUser = () => impl().getSessionUser();
export const getSessionUserFast: typeof sb.getSessionUserFast = () => impl().getSessionUserFast();
export const signInWithPassword: typeof sb.signInWithPassword = (e, p) => impl().signInWithPassword(e, p);
export const signUpWithPassword: typeof sb.signUpWithPassword = (i) => (isPostgres() ? pg.signUpWithPassword() : sb.signUpWithPassword(i));
export const signOutCurrent: typeof sb.signOutCurrent = () => impl().signOutCurrent();
export const requestPasswordReset: typeof sb.requestPasswordReset = (e, r) => impl().requestPasswordReset(e, r);
export const setPassword: typeof sb.setPassword = (p) => impl().setPassword(p);
export const confirmEmailLink: typeof sb.confirmEmailLink = (l) => impl().confirmEmailLink(l);
