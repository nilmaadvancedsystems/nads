// ViewModel de Fiscal › Controle de tributos (27/10/2026: "vamos implementar essa planilha de controle como modulo do
// fiscal"; as folhas do Protocolo de Entrega de Tributos do Simples e do Lucro Presumido): a competência, o grupo, a
// busca e a situação; uma linha por empresa do grupo (o regime do Cadastro do nads) com os valores, a data, as
// conferências e a entrega, guardados no banco a cada campo; o que o Entregas já entregou entra como sugestão (cinza) e
// "Preencher com o Entregas" passa para os campos em branco. No fim, as observações e a retificação; Imprimir sai a folha.
// Quem grava: o Fiscal e o admin; o resto da equipe só vê.
import { tarefas as t } from '@nads/core';
import { logoNilmaParaImprimir, useRetorno } from '@nads/ui';
import { useMemo, useRef, useState } from 'react';
import { competenciasDaTela } from '../../../casca/navegacao';
import { useOperador } from '../../../casca/operador';
import { FOLHA_VAZIA } from '../../../dados/controleTributos';
import { useControleTributos, useEntregasDeDocumentos, useGmailDoEntregas } from '../../../dados/repo';
import { useListaDoCadastro } from '../../cadastro/escolher/useListaDoCadastro';
import { imprimirHtml } from '../../dp/imprimirHtml';

export type SituacaoDoControle = '' | 'falta' | 'comecada' | 'entregue';
const SITUACOES: { id: Exclude<SituacaoDoControle, ''>; rotulo: string }[] = [
  { id: 'falta', rotulo: 'Em branco' }, { id: 'comecada', rotulo: 'Começadas' }, { id: 'entregue', rotulo: 'Entregues' },
];
const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
/** dd/mm/aaaa ↔ AAAA-MM-DD */
export const dataBr = (iso: string) => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '');
/** o mesmo conteúdo (sem quem e quando gravou) */
const mesmoConteudo = (a: t.LinhaDoControle, b: t.LinhaDoControle) => {
  const c = (l: t.LinhaDoControle) => JSON.stringify([l.grupo, l.data, l.entregue, Object.entries(l.valores).sort(), Object.entries(l.marcas).sort()]);
  return c(a) === c(b);
};
const dataIso = (br: string) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br); return m ? m[3] + '-' + m[2] + '-' + m[1] : ''; };

export function useControleDeTributos() {
  const { toast } = useRetorno();
  const op = useOperador().operador;
  const podeGravar = !!op && (op.admin || op.departamento === 'fiscal');
  const repo = useControleTributos();
  const lista = useListaDoCadastro();
  const entregas = useEntregasDeDocumentos();
  const gmail = useGmailDoEntregas();
  const [competencia, setCompetencia] = useState(() => competenciasDaTela(1)[0]);
  const [grupoId, setGrupoId] = useState<t.GrupoDoControleId>('sn');
  const [busca, setBusca] = useState('');
  const [situacao, setSituacao] = useState<SituacaoDoControle>('');
  const grupo = t.grupoDoControle(grupoId);
  const mes = repo.doMes(competencia);

  // as empresas do grupo: o regime do Cadastro do nads (o do Entregas, quando o nads não tem)
  const empresas = useMemo(() => lista.linhas
    .filter(l => l.codigo != null && grupo.regimes.includes(l.regime))
    .map(l => ({ codigo: l.codigo as number, nome: l.nome }))
    .sort((a, b) => a.codigo - b.codigo), [lista.linhas, grupo]);

  // as guias que o Entregas entregou na competência, ligadas ao código pelo cliente do Entregas
  const doMes = entregas.doMes(competencia);
  const codigoDoCliente = new Map(gmail.clientes().lista.map(c => [c.id, Number(c.codigo)]));
  const guias: t.GuiaEntregue[] = doMes.lista.flatMap(e => {
    const codigo = e.clienteId ? codigoDoCliente.get(e.clienteId) : undefined;
    return codigo && e.status === 'confirmada' ? [{ codigo, itens: e.itens, em: e.confirmadoEm, porEmail: e.comprovantePorEmail || e.canal === 'email' }] : [];
  });
  const sugestoes = t.sugestoesDoEntregas(grupo, empresas, guias);

  // o que acabou de ser gravado vale até o banco devolver (dois cliques seguidos não perdem o primeiro)
  const gravadas = useRef(new Map<string, t.LinhaDoControle>());
  const linhaDe = (codigo: number) => {
    const id = t.idDaLinhaDoControle(competencia, codigo);
    const minha = gravadas.current.get(id);
    const doBanco = mes.linhas.get(codigo);
    if (minha && doBanco && mesmoConteudo(minha, doBanco)) gravadas.current.delete(id);
    return gravadas.current.get(id) || doBanco || t.linhaEmBranco(competencia, codigo, grupo.id);
  };
  const linhas = empresas.map(e => {
    const l = linhaDe(e.codigo);
    return { ...e, linha: l, situacao: t.situacaoDaLinha(l), sugestao: sugestoes.get(e.codigo) };
  });
  const porSituacao = { falta: 0, comecada: 0, entregue: 0 };
  for (const l of linhas) porSituacao[l.situacao === 'branco' ? 'falta' : l.situacao]++;
  const q = semAcento(busca.trim());
  const achadas = linhas.filter(l => (!q || semAcento(l.nome).includes(q) || String(l.codigo).startsWith(q))
    && (!situacao || (situacao === 'falta' ? l.situacao === 'branco' : l.situacao === situacao)));
  const totais = Object.fromEntries(grupo.colunas.map(c => [c.id, linhas.reduce((s, l) => s + t.numeroDoControle(l.linha.valores[c.id] || ''), 0)]));
  const folha = mes.folhas.get(grupo.id) || FOLHA_VAZIA;
  // as linhas que ganham alguma coisa com a sugestão do Entregas
  const paraPreencher = linhas.flatMap(l => {
    const nova = l.sugestao ? t.preencherComSugestao(l.linha, l.sugestao) : l.linha;
    return JSON.stringify(nova) !== JSON.stringify(l.linha) ? [nova] : [];
  });

  async function gravar(l: t.LinhaDoControle) {
    if (!podeGravar) return;
    const nova = { ...l, grupo: grupo.id, atualizadoEm: undefined, atualizadoPor: undefined };
    const id = t.idDaLinhaDoControle(l.competencia, l.codigo);
    gravadas.current.set(id, nova);
    try { await repo.salvarLinha(nova); } catch { gravadas.current.delete(id); toast('Não deu para guardar: confira a internet e tente de novo'); }
  }
  async function gravarFolha(f: t.FolhaDoControle) {
    if (!podeGravar) return;
    try { await repo.salvarFolha(competencia, grupo.id, f); } catch { toast('Não deu para guardar: confira a internet e tente de novo'); }
  }

  return {
    carregando: !mes.carregada || lista.carregando,
    exemplos: repo.exemplos,
    podeGravar,
    competencia, setCompetencia, ultimoMes: competenciasDaTela(0)[0],
    grupo, grupos: t.GRUPOS_DO_CONTROLE.map(g => ({ valor: g.id, rotulo: g.rotulo })), setGrupo: (g: t.GrupoDoControleId) => { setGrupoId(g); setSituacao(''); },
    busca, setBusca, situacao, setSituacao, situacoes: SITUACOES, porSituacao,
    total: linhas.length, linhas: achadas,
    entregasCarregadas: doMes.carregada,
    totais: grupo.colunas.map(c => ({ id: c.id, rotulo: c.rotulo, valor: totais[c.id] ? brl(totais[c.id]) : '—' })),
    entregues: porSituacao.entregue,
    /** um campo de valor: guarda como fica na tela (1.234,50, — ou 0) */
    mudarValor(codigo: number, coluna: string, texto: string) {
      const l = linhaDe(codigo);
      const v = t.valorDoControle(texto);
      if ((l.valores[coluna] || '') === v) return;
      const valores = { ...l.valores };
      if (v) valores[coluna] = v; else delete valores[coluna];
      void gravar({ ...l, valores });
    },
    mudarData(codigo: number, br: string) {
      const l = linhaDe(codigo);
      const iso = br.trim() ? dataIso(br) : '';
      if (br.trim() && !iso) { toast('A data fica dd/mm/aaaa'); return; }
      if (iso !== l.data) void gravar({ ...l, data: iso });
    },
    /** a conferência anda em volta: em branco → OK → não se aplica → em branco */
    virarMarca(codigo: number, marca: string) {
      const l = linhaDe(codigo);
      const proxima = t.PROXIMA_MARCA[l.marcas[marca] || ''];
      const marcas = { ...l.marcas };
      if (proxima) marcas[marca] = proxima; else delete marcas[marca];
      void gravar({ ...l, marcas });
    },
    mudarEntrega(codigo: number, e: t.EntregaDoControle) {
      const l = linhaDe(codigo);
      // entregou sem data: a de hoje
      const data = e && e !== 'nao' && !l.data ? new Date().toISOString().slice(0, 10) : l.data;
      void gravar({ ...l, entregue: e, data });
    },
    comSugestaoParaUsar: paraPreencher.length,
    /** passa as sugestões do Entregas para os campos em branco (o que a pessoa escreveu fica) */
    async usarSugestoes() {
      const mudar = paraPreencher;
      for (const l of mudar) await gravar(l);
      toast(mudar.length === 1 ? '1 empresa preenchida com o Entregas' : mudar.length + ' empresas preenchidas com o Entregas');
    },
    folha,
    mudarObservacoes: (observacoes: string[]) => void gravarFolha({ ...folha, observacoes }),
    mudarRetificacoes: (retificacoes: t.RetificacaoDoControle[]) => void gravarFolha({ ...folha, retificacoes }),
    nomeDe: (codigo: number | null) => (codigo == null ? '' : empresas.find(e => e.codigo === codigo)?.nome || ''),
    imprimir() {
      imprimirHtml(t.htmlDoControle({ competencia, grupo, empresas, linhas: mes.linhas, folha, logo: logoNilmaParaImprimir('colorida') }));
      toast('Protocolo pronto: escolha a impressora');
    },
  };
}
export type VmControleDeTributos = ReturnType<typeof useControleDeTributos>;
