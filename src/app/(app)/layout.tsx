import Link from "next/link";
import { MenuCloser } from "@/components/menu-closer";
import Form from "next/form";
import { getMe } from "@/lib/catalog";
import { initials } from "@/lib/format";
import { NavLinks, BottomNav } from "@/components/nav-links";
import { signOut } from "../entrar/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, user } = await getMe();
  return (
    <>
      <a className="skip" href="#conteudo">Pular para o conteúdo</a>
      <header className="top">
        <div className="wrap">
          <Link className="logo" href="/" aria-label="Kentro Academy, início"><span className="logo-mark" aria-hidden><i /></span><span>Kentro <b>Academy</b></span></Link>
          <NavLinks />
          <Form className="search" action="/buscar" role="search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input name="q" type="search" placeholder="Buscar aulas" autoComplete="off" aria-label="Buscar aulas" />
          </Form>
          <details className="menu">
            <summary className="avatar" aria-label="Menu da conta">{initials(profile.full_name || user.email || "")}</summary>
            <div className="pop">
              <div><b>{profile.full_name || "Aluno"}</b><div className="dim" style={{ fontSize: 12 }}>{user.email}</div></div>
              <Link href="/meu">Meus cursos e certificados</Link>
              <Link href="/ajuda">Ajuda</Link>
              <Link href="/comecar">Trocar minha trilha</Link>
              {profile.is_admin && <Link href="/admin">Admin</Link>}
              <form action={signOut}><button>Sair</button></form>
            </div>
          </details>
        </div>
      </header>
      <main id="conteudo" tabIndex={-1}><div className="wrap">{children}</div></main>
      <BottomNav />
      <MenuCloser />
    </>
  );
}
