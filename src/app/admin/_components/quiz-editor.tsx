"use client";

import { useActionState, useRef, useState } from "react";
import { saveQuiz } from "../_actions/quizzes";
import type { AdminQuizQuestion } from "@/lib/admin/queries";
import { Field, SelectField } from "./field";
import { FormMessage } from "./form-message";
import { SubmitButton } from "./submit-button";
import { Ico } from "@/components/ico";

type Q = { key: number; question: string; options: string; correct: string; explanation: string; lesson: string };
const MAX = 50;

/** lessons: aulas do módulo para "Reveja a aula"; null enquanto a migração 0007 não for aplicada (campo some). */
export function QuizEditor({ moduleId, initial, lessons = null }: { moduleId: string; initial: AdminQuizQuestion[]; lessons?: { id: string; title: string }[] | null }) {
  const [state, action] = useActionState(saveQuiz, undefined);
  const nextKey = useRef(initial.length);
  const [qs, setQs] = useState<Q[]>(() =>
    initial.map((q, i) => ({ key: i, question: q.question, options: q.options.join("\n"), correct: String(q.correct), explanation: q.explanation ?? "", lesson: q.lesson_id ?? "" })),
  );
  const [clear, setClear] = useState(false);
  const err = state?.fieldErrors ?? {};
  const patch = (key: number, p: Partial<Q>) => setQs((l) => l.map((q) => (q.key === key ? { ...q, ...p } : q)));

  return (
    <form action={action} className="adm-form" noValidate>
      <input type="hidden" name="module_id" value={moduleId} />
      {qs.length === 0 && (
        <div className="adm-empty">
          <p>Este módulo ainda não tem perguntas. Clique em Adicionar pergunta para começar.</p>
        </div>
      )}
      {qs.map((q, i) => {
        const opts = q.options.split(/\r?\n/).map((o) => o.trim()).filter(Boolean);
        return (
          <fieldset key={q.key} className="adm-q">
            <legend className="adm-legend">Pergunta {i + 1}</legend>
            <Field name={`q${i}_question`} label="Enunciado" multiline rows={2} value={q.question} onChange={(e) => patch(q.key, { question: e.target.value })} error={err[`q${i}_question`]} />
            <Field
              name={`q${i}_options`} label="Alternativas" multiline rows={4} value={q.options}
              onChange={(e) => patch(q.key, { options: e.target.value })} error={err[`q${i}_options`]}
              hint="Uma alternativa por linha (de 2 a 6)."
            />
            <SelectField
              name={`q${i}_correct`} label="Resposta correta" value={q.correct}
              onChange={(e) => patch(q.key, { correct: e.target.value })} error={err[`q${i}_correct`]}
            >
              <option value="">Escolha a alternativa correta</option>
              {opts.map((o, j) => <option key={j} value={j}>{`${j + 1}. ${o.length > 60 ? o.slice(0, 57) + "…" : o}`}</option>)}
            </SelectField>
            <Field
              name={`q${i}_explanation`} label="Explicação" note="(o aluno vê quando passa no quiz, com 70% ou mais)" multiline rows={2}
              value={q.explanation} onChange={(e) => patch(q.key, { explanation: e.target.value })} error={err[`q${i}_explanation`]}
            />
            {lessons && lessons.length > 0 && (
              <SelectField
                name={`q${i}_lesson`} label="Aula para rever" note="(opcional: aparece para o aluno que errar esta pergunta)" value={q.lesson}
                onChange={(e) => patch(q.key, { lesson: e.target.value })} error={err[`q${i}_lesson`]}
              >
                <option value="">Nenhuma em especial</option>
                {lessons.map((l, j) => <option key={l.id} value={l.id}>{`${j + 1}. ${l.title}`}</option>)}
              </SelectField>
            )}
            <div>
              <button type="button" className="btn btn-s btn-sm adm-danger" onClick={() => setQs((l) => l.filter((x) => x.key !== q.key))}>
                Remover pergunta {i + 1}
              </button>
            </div>
          </fieldset>
        );
      })}

      <div className="adm-btns">
        <button
          type="button" className="btn btn-s" disabled={qs.length >= MAX}
          onClick={() => setQs((l) => [...l, { key: nextKey.current++, question: "", options: "", correct: "", explanation: "", lesson: "" }])}
        >
          <Ico name="plus" size={16} />Adicionar pergunta
        </button>
      </div>

      {qs.length === 0 && initial.length > 0 && (
        <label className="adm-check">
          <input type="checkbox" name="confirm_clear" value="1" checked={clear} onChange={(e) => setClear(e.target.checked)} />
          <span>Excluir todas as perguntas deste módulo</span>
        </label>
      )}
      <FormMessage state={state} />
      <div className="adm-btns">
        <SubmitButton disabled={qs.length === 0 && initial.length > 0 && !clear}>Salvar quiz</SubmitButton>
      </div>
    </form>
  );
}
