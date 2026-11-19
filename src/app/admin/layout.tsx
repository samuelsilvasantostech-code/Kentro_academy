import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAdmin } from "@/lib/admin/require-admin";
import { getPendingCount } from "@/lib/admin/queries";
import { AdminNav } from "./_components/admin-nav";
import { BackLink } from "./_components/back-link";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin · Kentro Academy" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const a = await getAdmin();
  if (!a) notFound();
  const pending = await getPendingCount();
  return (
    <div className="adm">
      <header className="adm-top">
        <div className="adm-top-in">
          <div className="adm-bar">
            <Link className="logo" href="/admin">Kentro<b>Academy</b><span className="adm-tag">Admin</span></Link>
            <BackLink href="/">Voltar para a Academy</BackLink>
          </div>
          <AdminNav pending={pending} />
        </div>
      </header>
      <main className="adm-main"><div className="wrap" style={{ display: "grid", gap: 24 }}>{children}</div></main>
    </div>
  );
}
