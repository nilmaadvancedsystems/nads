// ViewModel do "Subir a guia" (13/10/2026: "coloca a etapa de upar o DAS e DAE"): manda o PDF para Claudio
// Secretario/<mês>/<cliente> pelo envio do Drive (o robô acha a pasta pelo código) e acompanha cada arquivo.
// 16/10/2026: o PDF também é LIDO aqui (vencimento e valor, pelo leitor do core) e vai no envio; o robô põe a guia na
// Área do Cliente. Não leu: sobe igual, sem esses dados, e a linha mostra um aviso discreto.
import { areaCliente, entregas as e, extrator, tarefas as t } from '@nads/core';
import workerDoPdf from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { useEffect, useRef, useState } from 'react';
import { useDriveDoEntregas } from '../../dados/repo';

extrator.definirWorkerDoPdf(workerDoPdf);

export interface Subindo {
  id: number; nome: string; texto: string; pronto: boolean; erro: boolean;
  /** o que foi lido da guia, para a pessoa conferir ("vencimento 20/10/2026 · valor R$ 1.234,56") */
  lido?: string;
  /** por que não foi lido (a guia sobe do mesmo jeito) */
  semLeitura?: string;
}

/** Lê o PDF: a guia (DAS/DAE) esperada com vencimento e valor, ou o motivo de não ter lido. */
export async function lerPdfDaGuia(bytes: Uint8Array, esperada: 'DAS' | 'DAE'): Promise<{ leitura: areaCliente.LeituraDaGuia } | { motivo: string }> {
  try {
    if (!extrator.ehPdf(bytes)) return { motivo: 'não é um PDF' };
    const paginas = t.linhasDasPaginas(await extrator.itensDoPdf(bytes));
    const leitura = areaCliente.lerGuia(paginas.map(l => l.join('\n')).join('\n'));
    if (!leitura) return { motivo: 'não achei o vencimento e o valor no PDF' };
    if (leitura.guia !== esperada) return { motivo: 'o PDF parece ser um ' + leitura.guia + ', não um ' + esperada };
    return { leitura };
  } catch {
    return { motivo: 'não consegui ler o PDF' };
  }
}

const TEXTO: Record<e.AndamentoDoEnvio['status'], string> = {
  enviando: 'subindo', pendente: 'na fila do robô', gravando: 'o robô está gravando no Drive', pronto: 'no Drive', erro: 'erro',
};

export function useGuiaParaSubir(guia: 'DAS' | 'DAE', codigo: string, competencia: string, enviadas: number, marcar?: (n: number) => void) {
  const repo = useDriveDoEntregas();
  const [lista, setLista] = useState<Subindo[]>([]);
  const paradas = useRef(new Set<() => void>());
  const feitas = useRef(enviadas);
  useEffect(() => { feitas.current = Math.max(feitas.current, enviadas); }, [enviadas]);
  useEffect(() => {
    const p = paradas.current;
    return () => { for (const f of p) f(); };
  }, []);
  const mudar = (id: number, a: Partial<Subindo>) => setLista(l => l.map(x => (x.id === id ? { ...x, ...a } : x)));

  async function subir(f: File) {
    const id = Date.now() + Math.random();
    const problema = !/\.pdf$/i.test(f.name) ? 'não é PDF' : e.problemaDoArquivo({ nome: f.name, tamanho: f.size });
    setLista(l => [...l, { id, nome: f.name, texto: problema || 'preparando…', pronto: false, erro: !!problema }]);
    if (problema) return;
    let bytes: Uint8Array;
    try { bytes = new Uint8Array(await f.arrayBuffer()); } catch { mudar(id, { texto: 'não consegui ler o arquivo', erro: true }); return; }
    mudar(id, { texto: 'lendo a guia…' });
    const lida = await lerPdfDaGuia(bytes, guia);
    if ('leitura' in lida) mudar(id, { lido: 'vencimento ' + lida.leitura.vencimento + ' · valor R$ ' + lida.leitura.valor });
    else mudar(id, { semLeitura: lida.motivo });
    const dados = 'leitura' in lida ? { guia: lida.leitura.guia, vencimento: lida.leitura.vencimento, valor: lida.leitura.valor } : undefined;
    let parar = () => {};
    parar = repo.enviar({ nome: f.name, bytes }, { competencia, cliente: '', codigo, ...(dados ? { guia: dados } : {}) }, a => {
      if (a.status === 'enviando') { mudar(id, { texto: 'subindo' + (a.partes && a.partes > 1 ? ' (' + (a.enviadas || 0) + ' de ' + a.partes + ')' : '') + '…' }); return; }
      if (a.status === 'pronto') {
        parar(); paradas.current.delete(parar);
        mudar(id, { texto: 'em Claudio Secretario › ' + (a.pasta || '').split('/').join(' › '), pronto: true });
        feitas.current += 1;
        marcar?.(feitas.current);
      } else if (a.status === 'erro') {
        parar(); paradas.current.delete(parar);
        mudar(id, { texto: a.erro || 'erro', erro: true });
      } else mudar(id, { texto: TEXTO[a.status] + '…' });
    });
    paradas.current.add(parar);
  }
  const soltar = (fs: FileList | null | undefined) => { for (const f of fs ? [...fs] : []) void subir(f); };

  return { lista, soltar };
}
