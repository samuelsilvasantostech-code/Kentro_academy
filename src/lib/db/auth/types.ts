export type SessionUser = { id: string; email: string };

/** Motivo de falha de entrada/cadastro, já sem depender do texto do provedor. */
export type AuthFailure = "invalid_credentials" | "email_not_confirmed" | "user_exists" | "weak_password" | "other";

export type SignInResult = { error: AuthFailure | null };
export type SignUpResult = { error: AuthFailure | null; signedIn: boolean };
export type ResetRequestResult = "sent" | "rate_limited" | "server_error";
export type UpdatePasswordResult = "ok" | "same_password" | "weak_password" | "error";
export type EmailLinkParams = { tokenHash: string | null; type: string | null; code: string | null };
