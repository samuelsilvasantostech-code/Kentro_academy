"use client";

import { useState, useTransition } from "react";
import type { MigracaoResult } from "@/lib/db/admin/migracao";
import { conferirAction, copiarAction } from "../_actions/migracao";

export function MigracaoPanel() {
  const [ok, setOk] = useState(false);
  const [result, setResult] = useState<MigracaoResult | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<MigracaoResult>) =>
    start(async () => {
      setResult(null);
      setResult(await fn());
    });
  const all = result?.ok && result.conferencia.every((r) => r.confere);

  return (
    <>
      <section className="adm-card" aria-labelledby="mg-copiar">
        <h2 id="mg-copiar">Copiar os dados</h2>
        <p className="muted">
          Tudo o que estiver no banco do Doca é apagado e copiado de novo do banco atual, numa única etapa: se algo falhar,
          nada muda. O banco atual só é lido. Pode repetir quantas vezes precisar.
        </p>
        <label className="adm-check">
          <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} disabled={pending} />
          <span>Entendo que os dados do banco do Doca serão substituídos.</span>
        </label>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-p" disabled={!ok || pending} onClick={() => run(copiarAction)}>
            {pending ? "Aguarde…" : "Copiar e conferir"}
          </button>
          <button type="button" className="btn btn-s" disabled={pending} onClick={() => run(conferirAction)}>
            Só conferir
          </button>
        </div>
      </section>

      {result && !result.ok && <p className="err" role="alert">Não deu certo: {result.erro}</p>}
      {result?.ok && (
        <section className="adm-card" aria-labelledby="mg-res">
          <h2 id="mg-res">Resultado</h2>
          <p className={all ? "ok-msg" : "err"} role="status">
            {all ? "Tudo confere: o banco do Doca está igual ao atual." : "Há tabelas que não conferem. Rode a cópia de novo."}
          </p>
          <div className="pn-scroll">
            <table className="pn-table">
              <thead>
                <tr><th scope="col">Tabela</th>{result.copiadas && <th scope="col">Copiadas</th>}<th scope="col">Atual</th><th scope="col">Doca</th><th scope="col">Confere</th></tr>
              </thead>
              <tbody>
                {result.conferencia.map((r) => (
                  <tr key={r.tabela}>
                    <td>{r.tabela}</td>
                    {result.copiadas && <td>{result.copiadas.find((c) => c.tabela === r.tabela)?.linhas ?? "—"}</td>}
                    <td>{r.origem}</td>
                    <td>{r.destino}</td>
                    <td>{r.confere ? "Sim" : "Não"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
