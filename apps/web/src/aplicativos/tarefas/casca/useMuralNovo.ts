// Os avisos do mural que a pessoa ainda não leu (Vitor, 06/11/2026: "eles devem ver e ser notificados sobre coisas postadas
// no mural do app"): o número ao lado do Início na gaveta ☰ (e o ponto no ☰) até ela abrir o Início; e, com o app aberto,
// o aviso na tela e a notificação do navegador quando chega um novo. Os de quem escreveu não contam para ele mesmo.
// Lembrados neste navegador, por pessoa: os lidos (abriu o Início) e os já avisados. Na primeira vez neste navegador, os
// que já estavam contam como não lidos (a pessoa nunca viu o mural), mas não viram uma enxurrada de avisos.
import { tarefas as t } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useSyncExternalStore } from 'react';
import { useAvisos } from '../dados/repo';
import { useOperador } from './operador';

const CHAVE_LIDOS = 'nads-mural-lidos:';
const CHAVE_AVISADOS = 'nads-mural-avisados:';

/** quem guardou (a tela do Início marca, a gaveta conta): avisa os dois na hora */
const ouvintes = new Set<() => void>();
let versao = 0;
const assinar = (f: () => void) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; };
const mudou = () => { versao++; for (const f of ouvintes) f(); };

function ler(chave: string): string[] | null {
  try {
    const v = localStorage.getItem(chave);
    if (v == null) return null;
    const lista: unknown = JSON.parse(v);
    return Array.isArray(lista) ? lista.map(String) : [];
  } catch { return []; }
}
function guardar(chave: string, ids: string[]) {
  try { localStorage.setItem(chave, JSON.stringify(ids.slice(-300))); } catch { /* conta de novo na próxima */ }
}

const curto = (s: string) => (s.length > 120 ? s.slice(0, 120) + '…' : s);

/** a notificação do navegador (só com a permissão dada; sem ela, fica o aviso na tela) */
function notificar(titulo: string, texto: string) {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const n = new Notification(titulo, { body: texto, tag: 'nads-mural' });
    n.onclick = () => { window.focus(); n.close(); };
  } catch { /* o navegador não deixou: fica o aviso na tela */ }
}

/** Os avisos do mural para a pessoa: os não lidos (a gaveta) e o aviso dos novos, com o app aberto. */
export function useMuralNovo() {
  const repo = useAvisos();
  const eu = useOperador().operador?.nome || '';
  const { aviso } = useRetorno();
  useSyncExternalStore(assinar, () => versao, () => versao);
  const { carregados, avisos } = repo.lista();
  const deOutros = eu ? avisos.filter(a => a.por.trim().toLowerCase() !== eu.trim().toLowerCase()) : [];
  const lidos = eu ? ler(CHAVE_LIDOS + eu) : [];
  const naoLidos = carregados && eu ? deOutros.filter(a => !(lidos || []).includes(a.id)) : [];

  const marca = carregados && eu ? eu + ':' + deOutros.map(a => a.id).join(',') : '';
  useEffect(() => {
    if (!marca) return;
    const ja = ler(CHAVE_AVISADOS + eu);
    if (ja === null) { guardar(CHAVE_AVISADOS + eu, deOutros.map(a => a.id)); return; }
    const novos = t.ordenarAvisos(deOutros.filter(a => !ja.includes(a.id)));
    if (!novos.length) return;
    const titulo = novos.length === 1 ? 'Aviso novo no mural' : novos.length + ' avisos novos no mural';
    const texto = novos.length === 1 ? novos[0].por + ': "' + curto(novos[0].texto) + '"' : 'De ' + [...new Set(novos.map(a => a.por))].join(', ') + '. Abra o Início para ler.';
    aviso({ tom: 'info', icone: 'sino', titulo, texto });
    notificar(titulo, texto);
    guardar(CHAVE_AVISADOS + eu, [...ja, ...novos.map(a => a.id)]);
  // os ids dos avisos (e quem está) dizem tudo
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marca]);

  return { naoLidos: naoLidos.length };
}

/**
 * O Início aberto: os avisos que estão no mural ficam lidos (o número da gaveta some) e, na primeira vez, o navegador
 * pergunta se pode mandar notificação.
 */
export function useMuralLido(ids: readonly string[]) {
  const eu = useOperador().operador?.nome || '';
  const marca = eu + ':' + ids.join(',');
  useEffect(() => {
    if (!eu) return;
    const ja = ler(CHAVE_LIDOS + eu) || [];
    const faltam = ids.filter(id => !ja.includes(id));
    if (faltam.length || ler(CHAVE_LIDOS + eu) === null) { guardar(CHAVE_LIDOS + eu, [...ja, ...faltam]); mudou(); }
    try { if (typeof Notification !== 'undefined' && Notification.permission === 'default') void Notification.requestPermission(); } catch { /* sem notificação */ }
  // os ids dizem tudo
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marca]);
}
