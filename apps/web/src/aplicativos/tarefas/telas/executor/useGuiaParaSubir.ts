// ViewModel do "Subir a guia" (13/10/2026: "coloca a etapa de upar o DAS e DAE"): manda o PDF para Claudio
// Secretario/<mês>/<cliente> pelo envio do Drive (o robô acha a pasta pelo código) e acompanha cada arquivo.
import { entregas as e } from '@nads/core';
import { useEffect, useRef, useState } from 'react';
import { useDriveDoEntregas } from '../../dados/repo';

export interface Subindo { id: number; nome: string; texto: string; pronto: boolean; erro: boolean }

const TEXTO: Record<e.AndamentoDoEnvio['status'], string> = {
  enviando: 'subindo', pendente: 'na fila do robô', gravando: 'o robô está gravando no Drive', pronto: 'no Drive', erro: 'erro',
};

export function useGuiaParaSubir(codigo: string, competencia: string, enviadas: number, marcar?: (n: number) => void) {
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
    let parar = () => {};
    parar = repo.enviar({ nome: f.name, bytes }, { competencia, cliente: '', codigo }, a => {
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
  const soltar = (fs: FileList | File[] | null | undefined) => { for (const f of fs ? [...fs] : []) void subir(f); };

  return { lista, soltar };
}
