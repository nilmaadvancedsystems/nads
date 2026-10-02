// ViewModel do catálogo: o tipo da vez (a aba de cima, na URL), a tela escolhida no menu lateral (?tela=) e a busca.
// As peças vêm do catálogo (catalogo/pecas); a tela filtra as que aparecem nela; a busca, pelo nome e pelas classes.
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { PECAS, TELAS, TIPOS } from '../catalogo';
import type { IdTipo, Peca } from '../catalogo/tipos';

export const BASE = '/componentes';
const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function useCatalogo() {
  const { tipo: param = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const navegar = useNavigate();
  const [busca, setBusca] = useState('');
  const { modal, toast, aviso } = useRetorno();
  // o ▶: redesenha a peça (a animação de entrada roda de novo) ou mostra a peça completa de verdade
  const [vez, setVez] = useState<Record<string, number>>({});
  const [abertura, setAbertura] = useState<'completa' | 'vidro' | null>(null);
  const tipo = (TIPOS.find(t => t.id === param) || TIPOS[0]).id as IdTipo;
  const tela = TELAS.some(t => t.id === params.get('tela')) ? (params.get('tela') as string) : '';
  const q = norm(busca.trim());

  const doTipo = PECAS.filter(p => p.tipo === tipo);
  // as que saíram ficam no lugar do código delas (BT-04 entre a BT-03 e a BT-05), em preto e branco
  const pecas = doTipo
    .filter(p => !tela || p.telas.includes(tela))
    .filter(p => !q || norm([p.cod || '', p.nome, p.descricao || '', p.componente || '', ...(p.classes || [])].join(' ')).includes(q));

  // o menu lateral: as telas, por aplicativo, com quantas peças deste tipo cada uma tem
  const apps = [...new Set(TELAS.map(t => t.app))];
  const telas = TELAS.map(t => ({ ...t, qtd: doTipo.filter(p => p.telas.includes(t.id)).length, grupo: apps.indexOf(t.app) + 1 }));

  return {
    tipos: TIPOS.map(t => ({ ...t, ativo: t.id === tipo, qtd: PECAS.filter(p => p.tipo === t.id && !p.removida && (!tela || p.telas.includes(tela))).length })),
    tipo: TIPOS.find(t => t.id === tipo)!,
    tela, nomeDaTela: TELAS.find(t => t.id === tela),
    telas, apps,
    pecas, total: doTipo.length,
    busca, setBusca,
    /** quantas vezes a peça foi reproduzida (a chave do desenho: muda, redesenha) */
    vezDe: (id: string) => vez[id] || 0,
    abertura,
    reproduzir(p: Peca) {
      if (!p.aoVivo) { setVez(v => ({ ...v, [p.id]: (v[p.id] || 0) + 1 })); return; }
      p.aoVivo({
        modal: o => modal(o),
        toast,
        aviso,
        abertura: tipo => { setAbertura(tipo); setTimeout(() => setAbertura(null), tipo === 'completa' ? 4200 : 2600); },
      });
    },
    /** para onde foi a peça que saiu: Excluída · Movida para … · Substituída por BT-01 Botão padrão */
    destinoDe(p: Peca) {
      const r = p.removida;
      if (!r) return '';
      const por = r.por ? PECAS.find(x => x.id === r.por) : undefined;
      const como = r.como === 'excluida' ? 'Excluída' : r.como === 'movida' ? 'Movida' + (r.para ? ' para ' + r.para : '') : 'Substituída' + (por ? ' por ' + por.cod + ' ' + por.nome : '');
      return como + ' em ' + r.em;
    },
    nomeDe: (id: string) => { const t = TELAS.find(x => x.id === id); return t ? t.app + ' › ' + t.nome : id; },
    escolherTipo: (id: string) => navegar(BASE + '/' + id + (tela ? '?tela=' + encodeURIComponent(tela) : '')),
    escolherTela: (id: string) => { const n = new URLSearchParams(params); if (!id || id === tela) n.delete('tela'); else n.set('tela', id); setParams(n); },
  };
}
