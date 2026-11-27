import { createHmac, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

/**
 * Regras do login próprio, sem Next (testáveis contra Postgres real).
 * O token vai só no cookie ou no link do e-mail; no banco fica o HMAC-SHA256 dele com AUTH_SECRET.
 */
export type Db = { query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }> };

export const SESSION_DAYS = 30;
export const RESET_MINUTES = 60;
export const INVITE_DAYS = 7;
const MAX_FAIL_EMAIL = 5; // por e-mail, em 15 min
const MAX_FAIL_IP = 20; // por IP, em 15 min
const MAX_RESET_HOUR = 3; // links de redefinição por conta, por hora
const BCRYPT_COST = 10;

export function authSecret(): string {
  const s = process.env.AUTH_SECRET ?? "";
  if (s.length < 32) throw new Error("AUTH_SECRET ausente ou curta (mínimo 32 caracteres)");
  return s;
}

export const newToken = () => randomBytes(32).toString("base64url");
export const hashToken = (token: string, secret = authSecret()) => createHmac("sha256", secret).update(token).digest("hex");
export const normEmail = (e: string) => e.trim().toLowerCase().slice(0, 254);

// Hash fixo para comparar mesmo quando o e-mail não existe: o tempo de resposta não revela contas.
const DUMMY_HASH = bcrypt.hashSync("kentro-conta-inexistente", BCRYPT_COST);

export type LoginOutcome =
  | { ok: true; userId: string; token: string }
  | { ok: false; reason: "invalid_credentials" | "email_not_confirmed" | "rate_limited" };

async function tooManyFailures(db: Db, email: string, ip: string | null): Promise<boolean> {
  const { rows } = await db.query(
    `select
       count(*) filter (where key = $1)::int as by_email,
       count(*) filter (where key = $2)::int as by_ip
     from login_attempts where not ok and at > now() - interval '15 minutes' and key in ($1, $2)`,
    [`email:${email}`, `ip:${ip ?? "-"}`],
  );
  const r = rows[0] as { by_email: number; by_ip: number };
  return r.by_email >= MAX_FAIL_EMAIL || (!!ip && r.by_ip >= MAX_FAIL_IP);
}

async function record(db: Db, email: string, ip: string | null, ok: boolean) {
  await db.query(
    `insert into login_attempts (key, ok) select k, $2 from unnest($1::text[]) k`,
    [ip ? [`email:${email}`, `ip:${ip}`] : [`email:${email}`], ok],
  );
  // Faxina leve: tentativas com mais de 1 dia não servem para nada.
  if (Math.random() < 0.02) await db.query(`delete from login_attempts where at < now() - interval '1 day'`);
}

export async function createSession(db: Db, userId: string, secret?: string): Promise<string> {
  const token = newToken();
  await db.query(
    `insert into sessions (token_hash, user_id, expires_at) values ($1, $2, now() + make_interval(days => $3))`,
    [hashToken(token, secret), userId, SESSION_DAYS],
  );
  return token;
}

export async function login(db: Db, rawEmail: string, password: string, ip: string | null, secret?: string): Promise<LoginOutcome> {
  const email = normEmail(rawEmail);
  if (await tooManyFailures(db, email, ip)) return { ok: false, reason: "rate_limited" };
  const { rows } = await db.query(
    `select id, password_hash, email_confirmed_at from users where email = $1 and disabled_at is null`,
    [email],
  );
  const u = rows[0] as { id: string; password_hash: string | null; email_confirmed_at: Date | null } | undefined;
  const match = await bcrypt.compare(password.slice(0, 72), u?.password_hash ?? DUMMY_HASH);
  if (!u || !u.password_hash || !match) {
    await record(db, email, ip, false);
    return { ok: false, reason: "invalid_credentials" };
  }
  if (!u.email_confirmed_at) return { ok: false, reason: "email_not_confirmed" };
  await record(db, email, ip, true);
  return { ok: true, userId: u.id, token: await createSession(db, u.id, secret) };
}

export async function sessionUser(db: Db, token: string, secret?: string): Promise<{ id: string; email: string } | null> {
  const { rows } = await db.query(
    `select u.id, u.email from sessions s join users u on u.id = s.user_id
     where s.token_hash = $1 and s.expires_at > now() and u.disabled_at is null`,
    [hashToken(token, secret)],
  );
  const r = rows[0] as { id: string; email: string } | undefined;
  return r ? { id: r.id, email: r.email } : null;
}

export async function deleteSession(db: Db, token: string, secret?: string) {
  await db.query(`delete from sessions where token_hash = $1`, [hashToken(token, secret)]);
}

/** Link de redefinição. null = conta inexistente/desativada ou limite atingido (quem pede vê sempre a mesma resposta). */
export async function createResetToken(db: Db, rawEmail: string, secret?: string): Promise<{ token: string; email: string } | null> {
  const email = normEmail(rawEmail);
  const { rows } = await db.query(
    `select u.id,
       (select count(*)::int from auth_tokens t where t.user_id = u.id and t.purpose = 'reset'
          and t.created_at > now() - interval '1 hour') as recent
     from users u where u.email = $1 and u.disabled_at is null`,
    [email],
  );
  const u = rows[0] as { id: string; recent: number } | undefined;
  if (!u || u.recent >= MAX_RESET_HOUR) return null;
  const token = newToken();
  await db.query(
    `insert into auth_tokens (token_hash, user_id, purpose, expires_at)
     values ($1, $2, 'reset', now() + make_interval(mins => $3))`,
    [hashToken(token, secret), u.id, RESET_MINUTES],
  );
  return { token, email };
}

/** Usa o link (uma vez só) e devolve o usuário. Convite aceito também confirma o e-mail. */
export async function consumeToken(db: Db, token: string, purpose: "reset" | "invite", secret?: string): Promise<string | null> {
  const { rows } = await db.query(
    `update auth_tokens set used_at = now()
     where token_hash = $1 and purpose = $2 and used_at is null and expires_at > now()
       and user_id in (select id from users where disabled_at is null)
     returning user_id`,
    [hashToken(token, secret), purpose],
  );
  const id = (rows[0] as { user_id: string } | undefined)?.user_id ?? null;
  if (id) await db.query(`update users set email_confirmed_at = coalesce(email_confirmed_at, now()) where id = $1`, [id]);
  return id;
}

export type ChangePasswordResult = "ok" | "same_password" | "weak_password" | "error";

/** Troca a senha e derruba as outras sessões da conta (mantém a atual). */
export async function changePassword(
  db: Db, userId: string, password: string, keepToken: string | null, secret?: string,
): Promise<ChangePasswordResult> {
  if (password.length < 8 || password.length > 72) return "weak_password";
  const { rows } = await db.query(`select password_hash from users where id = $1 and disabled_at is null`, [userId]);
  const u = rows[0] as { password_hash: string | null } | undefined;
  if (!u) return "error";
  if (u.password_hash && (await bcrypt.compare(password, u.password_hash))) return "same_password";
  const hash = await bcrypt.hash(password, BCRYPT_COST);
  await db.query(`update users set password_hash = $2, updated_at = now() where id = $1`, [userId, hash]);
  await db.query(
    `delete from sessions where user_id = $1 and token_hash <> coalesce($2, '')`,
    [userId, keepToken ? hashToken(keepToken, secret) : null],
  );
  await db.query(`update auth_tokens set used_at = now() where user_id = $1 and used_at is null and purpose = 'reset'`, [userId]);
  return "ok";
}

export async function isAdmin(db: Db, userId: string): Promise<boolean> {
  const { rows } = await db.query(`select is_admin($1) as a`, [userId]);
  return (rows[0] as { a: boolean } | undefined)?.a === true;
}
