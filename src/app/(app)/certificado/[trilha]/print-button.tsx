"use client";

import { Ico } from "@/components/ico";

export function PrintButton() {
  return <button type="button" className="btn btn-p" onClick={() => window.print()}><Ico name="print" />Imprimir ou salvar PDF</button>;
}
