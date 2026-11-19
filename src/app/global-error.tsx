"use client";

// Só aparece se o layout raiz quebrar. Renderiza o próprio <html> e não carrega o globals.css:
// por isso as cores do tema claro (papel, tinta e violeta Kentro) vão inline.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, boxSizing: "border-box", background: "#EEF1F8", color: "#1A1C3A", fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif", lineHeight: 1.6 }}>
        <title>Erro inesperado · Kentro Academy</title>
        <main style={{ maxWidth: 460, textAlign: "center", background: "#FFFFFF", border: "1px solid #D6DBEA", borderRadius: 20, padding: "32px 28px" }}>
          <p style={{ margin: "0 0 12px", fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em" }}>Kentro<span style={{ color: "#5A1BD8" }}>Academy</span></p>
          <h1 style={{ margin: "0 0 10px", fontSize: 26, lineHeight: 1.2 }}>Não foi possível abrir a Academy</h1>
          <p style={{ margin: "0 0 20px", color: "#565A7E" }}>Houve uma falha ao carregar o aplicativo. Tente de novo; se continuar, avise a equipe Kentro informando o código abaixo.</p>
          {error?.digest && <p style={{ margin: "0 0 20px", fontSize: 13, color: "#646989" }}>Código do erro: {error.digest}</p>}
          <button onClick={() => retry()} style={{ minHeight: 44, padding: "12px 22px", borderRadius: 12, border: 0, background: "#6D28F5", color: "#FFFFFF", font: "inherit", fontWeight: 600, cursor: "pointer" }}>Tentar de novo</button>
        </main>
      </body>
    </html>
  );
}
