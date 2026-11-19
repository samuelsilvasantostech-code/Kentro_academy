"use client";

import Link from "next/link";
import { Ico } from "@/components/ico";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="state">
      <div className="state-in">
        <span className="state-ico err-i" aria-hidden="true"><Ico name="alert" size={30} /></span>
        <h1>Não foi possível carregar esta página</h1>
        <p className="muted">Houve uma falha ao buscar o conteúdo. Pode ser a sua conexão ou uma instabilidade nossa. Tente de novo; se continuar, avise a equipe Kentro informando o código abaixo.</p>
        {error.digest && <p className="dim state-code">Código do erro: {error.digest}</p>}
        <div className="state-btns">
          <button className="btn btn-p" onClick={() => retry()}><Ico name="refresh" />Tentar de novo</button>
          <Link className="btn btn-s" href="/">Ir para o início</Link>
        </div>
      </div>
    </div>
  );
}
