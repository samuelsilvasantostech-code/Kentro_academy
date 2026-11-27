"use client";

import { useEffect, useState, useTransition } from "react";
import { linkLesson } from "../_actions/lessons";
import { ADMIN_ACTION_EVENT } from "./action-button";
import { SelectField } from "./field";

/** A mensagem reflete a última ação: some ao começar outra (aqui ou em um botão da página, como Desvincular). */
function useClearOnAdminAction(clear: () => void) {
  useEffect(() => {
    window.addEventListener(ADMIN_ACTION_EVENT, clear);
    return () => window.removeEventListener(ADMIN_ACTION_EVENT, clear);
  }, [clear]);
}

/** Vincula uma aula já existente a um módulo (a mesma aula pode estar em várias trilhas). */
export function LinkLessonToModule({ moduleId, lessons }: { moduleId: string; lessons: { id: string; title: string }[] }) {
  const [lessonId, setLessonId] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  useClearOnAdminAction(() => setMsg(null));
  if (!lessons.length) return null;
  return (
    <div className="adm-btns" style={{ alignItems: "flex-end" }}>
      <div style={{ flex: 1, minWidth: 220 }}>
        <SelectField name={`link-${moduleId}`} label="Vincular aula existente" value={lessonId} onChange={(e) => setLessonId(e.target.value)}>
          <option value="">Escolha a aula</option>
          {lessons.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
        </SelectField>
      </div>
      <button
        type="button" className="btn btn-s btn-sm" disabled={!lessonId || pending}
        onClick={() =>
          start(async () => {
            setMsg(null);
            const r = await linkLesson(lessonId, moduleId);
            setMsg({ ok: !!r?.ok, text: r?.message ?? (r?.ok ? "Aula vinculada." : "Não foi possível vincular a aula. Tente de novo.") });
            if (r?.ok) setLessonId("");
          })
        }
      >
        {pending ? "Vinculando…" : "Vincular aula"}
      </button>
      {msg && <p className={msg.ok ? "ok-msg" : "err"} role={msg.ok ? "status" : "alert"} style={{ width: "100%" }}>{msg.text}</p>}
    </div>
  );
}

/** Vincula esta aula a outro módulo (trilha, depois módulo). */
export function LinkToAnotherModule({
  lessonId, tracks,
}: { lessonId: string; tracks: { id: string; name: string; modules: { id: string; title: string }[] }[] }) {
  const [trackId, setTrackId] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  useClearOnAdminAction(() => setMsg(null));
  const modules = tracks.find((t) => t.id === trackId)?.modules ?? [];
  return (
    <div className="adm-form">
      <div className="adm-2">
        <SelectField name="lt" label="Trilha" value={trackId} onChange={(e) => { setTrackId(e.target.value); setModuleId(""); }}>
          <option value="">Escolha a trilha</option>
          {tracks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </SelectField>
        <SelectField name="lm" label="Módulo" value={moduleId} disabled={!trackId} onChange={(e) => setModuleId(e.target.value)}>
          <option value="">Escolha o módulo</option>
          {modules.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
        </SelectField>
      </div>
      <div className="adm-btns">
        <button
          type="button" className="btn btn-s btn-sm" disabled={!moduleId || pending}
          onClick={() =>
            start(async () => {
              setMsg(null);
              const r = await linkLesson(lessonId, moduleId);
              setMsg({ ok: !!r?.ok, text: r?.message ?? (r?.ok ? "Aula vinculada." : "Não foi possível vincular a aula. Tente de novo.") });
            })
          }
        >
          {pending ? "Vinculando…" : "Vincular ao módulo"}
        </button>
      </div>
      {msg && <p className={msg.ok ? "ok-msg" : "err"} role={msg.ok ? "status" : "alert"}>{msg.text}</p>}
    </div>
  );
}
