"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveLesson } from "../_actions/lessons";
import type { AdminLessonDetail, AdminTrack } from "@/lib/db/admin";
import { chaptersToText, formatDuration, materialsToText } from "@/lib/admin/validate";
import { Field, SelectField } from "./field";
import { FormMessage } from "./form-message";
import { SubmitButton } from "./submit-button";
import { YoutubePreview } from "./youtube-preview";
import { ArticleBody, parseArticle } from "@/lib/article";

type Props = {
  initial?: AdminLessonDetail;
  /** Só na criação: trilhas com módulos, para os selects dependentes. */
  tracks?: AdminTrack[];
  presetModule?: string;
  /** Migração 0007 aplicada: mostra o campo de pontos-chave. */
  keyPoints?: boolean;
  /** Migração 0008 aplicada: mostra o texto da aula. */
  lessonText?: boolean;
  /** Migração 0009 aplicada: mostra o campo de transcrição (só para a busca). */
  transcript?: boolean;
};

export function LessonForm({ initial, tracks = [], presetModule, keyPoints = false, lessonText = false, transcript = false }: Props) {
  const [state, action] = useActionState(saveLesson, undefined);
  const router = useRouter();
  const editing = !!initial;
  const err = state?.fieldErrors ?? {};
  const v = (k: string, fallback: string) => state?.values?.[k] ?? fallback;

  const presetTrack = tracks.find((t) => t.modules.some((m) => m.id === presetModule))?.id ?? "";
  const [youtube, setYoutube] = useState(initial?.youtube_id ?? "");
  const [trackId, setTrackId] = useState(presetTrack);
  const [moduleId, setModuleId] = useState(presetTrack ? (presetModule ?? "") : "");
  const modules = tracks.find((t) => t.id === trackId)?.modules ?? [];
  const hasVideo = youtube.trim() !== "";
  const [body, setBody] = useState(initial?.text.body ?? "");
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    if (!editing && state?.ok && state.id) router.push(`/admin/aulas/${state.id}?nova=1`);
  }, [editing, state, router]);

  return (
    <form action={action} className="adm-form" noValidate>
      <input type="hidden" name="id" value={initial?.id ?? ""} />

      <div className="adm-card">
        <h2>Vídeo</h2>
        <Field
          name="youtube" label="Link do YouTube" value={youtube} onChange={(e) => setYoutube(e.target.value)}
          error={err.youtube} placeholder="https://youtu.be/dQw4w9WgXcQ" autoComplete="off" inputMode="url"
          hint="Cole o link do YouTube ou o ID do vídeo. Deixe vazio para uma aula só de leitura."
        />
        <YoutubePreview value={youtube} />
        {hasVideo && (
          <Field
            name="duration" label="Duração" defaultValue={v("duration", initial ? formatDuration(initial.duration_seconds) : "")}
            error={err.duration} placeholder="4:32" hint="Minutos e segundos, no formato m:ss." style={{ maxWidth: 160 }}
          />
        )}
      </div>

      {!editing && (
        <div className="adm-card">
          <h2>Onde a aula entra</h2>
          <div className="adm-2">
            <SelectField
              name="track_id" label="Trilha" value={trackId}
              onChange={(e) => { setTrackId(e.target.value); setModuleId(""); }}
            >
              <option value="">Escolha a trilha</option>
              {tracks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </SelectField>
            <SelectField
              name="module_id" label="Módulo" value={moduleId} onChange={(e) => setModuleId(e.target.value)}
              disabled={!trackId} error={err.module_id} required
              hint={trackId && modules.length === 0 ? "Esta trilha ainda não tem módulos. Crie um na página da trilha." : "A aula entra no fim do módulo."}
            >
              <option value="">{trackId ? "Escolha o módulo" : "Escolha a trilha primeiro"}</option>
              {modules.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
            </SelectField>
          </div>
        </div>
      )}

      <div className="adm-card">
        <h2>Conteúdo</h2>
        <Field name="title" label="Título" required defaultValue={v("title", initial?.title ?? "")} error={err.title} />
        <Field name="summary" label="Resumo" note="(opcional)" multiline rows={4} defaultValue={v("summary", initial?.summary ?? "")} error={err.summary} />
        {keyPoints && (
          <Field
            name="key_points" label="Pontos-chave" note="(opcional)" multiline rows={4} error={err.key_points}
            defaultValue={v("key_points", initial?.key_points.join("\n") ?? "")} hint="O que o aluno precisa lembrar. Um por linha, até 8."
            placeholder={"Etiquetas organizam os atendimentos por assunto\nSó o administrador cria etiquetas novas"}
          />
        )}
        <Field
          name="steps" label="Faça agora no seu Kentro" multiline rows={4} error={err.steps}
          defaultValue={v("steps", initial?.steps.join("\n") ?? "")} hint="Um passo por linha."
          placeholder={"Abra o menu Configurações\nClique em Etiquetas e crie uma nova"}
        />
        <Field
          name="chapters" label="Capítulos" multiline rows={4} error={err.chapters}
          defaultValue={v("chapters", initial ? chaptersToText(initial.chapters) : "")} hint="Um por linha: tempo e título."
          placeholder={"0:00 Introdução\n1:30 Criando a etiqueta"}
        />
        <Field
          name="materials" label="Materiais" multiline rows={4} error={err.materials}
          defaultValue={v("materials", initial ? materialsToText(initial.materials) : "")}
          hint="Um por linha: Título | link | descrição (opcional)."
          placeholder="Manual de etiquetas | https://exemplo.com/manual.pdf | Passo a passo em PDF"
        />
      </div>

      {lessonText && (
        <div className="adm-card">
          <h2>Texto da aula</h2>
          <p className="dim">Aparece abaixo do vídeo, como um artigo. Use <code>## Título</code> para seções, <code>- item</code> para listas, <code>**negrito**</code>, <code>`Menu &gt; Opção`</code> e <code>&gt; [!dica]</code>, <code>&gt; [!atencao]</code> ou <code>&gt; [!importante]</code> para destaques.</p>
          <div className="adm-tabs-mini" role="group" aria-label="Modo do texto">
            <button type="button" className={preview ? "" : "on"} aria-pressed={!preview} onClick={() => setPreview(false)}>Escrever</button>
            <button type="button" className={preview ? "on" : ""} aria-pressed={preview} onClick={() => setPreview(true)}>Prévia</button>
          </div>
          <div hidden={preview}>
            <Field name="body_md" label="Texto" note="(opcional)" multiline rows={18} value={body} onChange={(e) => setBody(e.target.value)} error={err.body_md} />
          </div>
          {preview && <div className="lart adm-lart"><div className="lart-body">{body.trim() ? <ArticleBody a={parseArticle(body)} /> : <p className="dim">Nada escrito ainda.</p>}</div></div>}
          <label className="adm-check">
            <input type="checkbox" name="body_pub" defaultChecked={initial?.text.published ?? false} />
            <span>Publicar o texto para os alunos <span className="dim">(desmarcado, fica como rascunho e só administradores veem)</span></span>
          </label>
        </div>
      )}

      {transcript && (
        <div className="adm-card">
          <h2>Transcrição (só para a busca; o aluno não vê)</h2>
          <Field
            name="transcript" label="Transcrição do vídeo" note="(opcional)" multiline rows={10} error={err.transcript}
            defaultValue={v("transcript", initial?.transcript ?? "")}
            hint="Cole o texto falado no vídeo. Ele só ajuda o aluno a achar a aula na busca e nunca aparece na tela. Pequenos erros de reconhecimento não atrapalham. Tire nomes de clientes, telefones e e-mails."
          />
        </div>
      )}

      <FormMessage state={state} />
      <div className="adm-btns">
        <SubmitButton>{editing ? "Salvar aula" : "Criar aula como rascunho"}</SubmitButton>
      </div>
    </form>
  );
}
