// DP › Legislação (Vitor, 14/10/2026: "importa as legislações em uma aba no DP"): os textos de consulta que vieram do Toriba
// (core empresas/legislacaoDp.ts) e os cadastrados no nads (Vitor, 14/10/2026: "coloque o botão de cadastro de legislação";
// banco legislacaoDp/{id}: as novas e as do Toriba editadas, por cima do texto do core). A busca procura no assunto e no
// texto; clicar abre a janela do assunto, numa tela só (Vitor, 28/10/2026: o texto e o editar juntos, o lápis no alto e o ✓ e o ✕
// só enquanto edita); o DP e o admin cadastram e editam.
import { empresas } from '@nads/core';
import { useMemo, useState } from 'react';
import { useRetorno } from '@nads/ui';
import { useOperador } from '../../casca/operador';
import { useLegislacaoDp } from '../../dados/repo';

/** Uma legislação na tela: a do Toriba (id 'toriba-<n>', editada ou não) ou a cadastrada no nads. */
export interface LegislacaoNaTela {
  id: string;
  assunto: string;
  texto: string;
  observacoes: string;
  data: string;
  origem: 'Toriba' | 'nads';
  /** quem mexeu por último no nads (vazio = o texto do Toriba como veio) */
  atualizadoPor: string;
}

interface Rascunho { id: string | null; assunto: string; texto: string; observacoes: string }

/** sem acento e minúsculo, para a busca achar "ferias" em "Férias" */
const simples = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function useLegislacaoDoDp() {
  const repo = useLegislacaoDp();
  const { toast } = useRetorno();
  const op = useOperador().operador;
  const podeEditar = !!op && (op.admin || op.departamento === 'dp');
  const [busca, setBusca] = useState('');
  const [aberta, setAberta] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [salvando, setSalvando] = useState(false);
  const doBanco = repo.lista();

  const todas = useMemo<LegislacaoNaTela[]>(() => {
    const porId = new Map(doBanco.lista.map(l => [l.id, l]));
    const doToriba = empresas.LEGISLACAO_DP.map(b => {
      const id = 'toriba-' + b.id;
      const m = porId.get(id);
      return { id, assunto: m?.assunto || b.assunto, texto: m?.texto || b.texto, observacoes: m ? m.observacoes : b.observacoes, data: b.data, origem: 'Toriba' as const, atualizadoPor: m?.atualizadoPor || '' };
    });
    const novas = doBanco.lista.filter(l => !l.id.startsWith('toriba-'))
      .map(l => ({ id: l.id, assunto: l.assunto, texto: l.texto, observacoes: l.observacoes, data: l.data, origem: 'nads' as const, atualizadoPor: l.atualizadoPor }));
    return [...doToriba, ...novas].sort((a, b) => a.assunto.localeCompare(b.assunto, 'pt-BR'));
  }, [doBanco.lista]);

  const itens = useMemo(() => {
    const q = simples(busca.trim());
    if (!q) return todas;
    // o assunto primeiro, depois o que só tem a palavra no texto
    const noAssunto = todas.filter(l => simples(l.assunto).includes(q));
    const noTexto = todas.filter(l => !noAssunto.includes(l) && simples(l.texto + ' ' + l.observacoes).includes(q));
    return [...noAssunto, ...noTexto];
  }, [busca, todas]);

  const item = aberta == null ? null : todas.find(l => l.id === aberta) || null;
  const valido = !!rascunho && rascunho.assunto.trim().length > 0 && rascunho.texto.trim().length > 0;

  return {
    busca, setBusca, itens, total: todas.length, item, podeEditar,
    /** editando: o lápis foi clicado (ou é uma nova) */
    editando: !!rascunho,
    abrir(id: string) { setAberta(id); setRascunho(null); },
    fechar() { setAberta(null); setRascunho(null); },
    /** o botão "Nova legislação": a janela já editando */
    nova() { setAberta('nova'); setRascunho({ id: null, assunto: '', texto: '', observacoes: '' }); },
    /** o lápis: os campos no lugar do texto */
    editar() { if (item) setRascunho({ id: item.id, assunto: item.assunto, texto: item.texto, observacoes: item.observacoes }); },
    /** o ✕: a nova fecha; a editada volta ao texto */
    cancelar() { if (rascunho && !rascunho.id) setAberta(null); setRascunho(null); },
    rascunho, valido, salvando,
    mudar(campo: 'assunto' | 'texto' | 'observacoes', valor: string) { setRascunho(r => (r ? { ...r, [campo]: valor } : r)); },
    async salvar() {
      if (!rascunho || !valido || salvando) return;
      setSalvando(true);
      try {
        const id = await repo.salvar({ id: rascunho.id || undefined, assunto: rascunho.assunto.trim(), texto: rascunho.texto.trim(), observacoes: rascunho.observacoes.trim(), data: item?.data || undefined });
        toast(rascunho.id ? 'Legislação salva.' : 'Legislação cadastrada.');
        setAberta(id); setRascunho(null);
      } catch (e) {
        toast('Não deu para salvar: ' + (e instanceof Error ? e.message : String(e)));
      } finally { setSalvando(false); }
    },
    /** 'aaaa-mm-dd' → 'dd/mm/aaaa' */
    data: (iso: string) => (iso ? iso.split('-').reverse().join('/') : ''),
    /** o começo do texto, numa linha, para a tabela */
    trecho: (t: string) => { const u = t.replace(/\s+/g, ' ').trim(); return u.length > 110 ? u.slice(0, 110).trimEnd() + '…' : u; },
  };
}
