// ViewModel do Controle contábil (23/11/2026: a planilha "CONTROLE CONTÁBIL 2026" do Fernando no nads): as empresas
// acompanhadas no ano, cada uma com o mês até onde a contabilidade está feita, a situação calculada (em dia, atrasada, não
// iniciada, não acompanhar) e a pendência. O código, o nome, o regime e o responsável vêm do Cadastro; a rotina do Contábil
// concluída no executor (os dois últimos meses esperados) vira sugestão do mês. As empresas entram pelo + Empresa, pelo
// Trazer as minhas (o responsável do Contábil no Cadastro), pela cópia do ano anterior ou pela planilha (.xlsx), com a
// prévia antes de gravar. Grava o Contábil e o admin; o resto só vê. As regras são as de t.*Contabil (core).
import { tarefas as t } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { caminhoDaEmpresa } from '../../../casca/navegacao';
import { useOperador } from '../../../casca/operador';
import { useControleContabil, useExecucoesDoPeriodo } from '../../../dados/repo';
import { useListaDoCadastro } from '../../cadastro/escolher/useListaDoCadastro';
import { useEmpresasDaPessoa } from '../../empresas/andamento';

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const mesmoConteudo = (a: t.LinhaDoControleContabil, b: t.LinhaDoControleContabil) =>
  a.feitaAte === b.feitaAte && a.observacao === b.observacao && a.pausada === b.pausada;
const comp = (ano: number, mes: number) => ano + '-' + String(mes).padStart(2, '0');

/** O que a importação vai fazer, mostrado na janela antes de gravar */
export interface PreviaDaImportacao {
  arquivo: string;
  lidas: number;
  plano: t.PlanoDaImportacaoContabil;
  ignoradas: t.LeituraDaPlanilhaContabil['ignoradas'];
  nomeDe: (codigo: number) => string;
  /** as linhas que o nads tinha antes (o "era" da prévia) */
  antes: ReadonlyMap<number, t.LinhaDoControleContabil>;
}

export function useControleDoContabil() {
  const { toast } = useRetorno();
  const op = useOperador().operador;
  const podeGravar = !!op && (op.admin || op.departamento === 'contabil');
  const [params, setParams] = useSearchParams();
  const hoje = new Date();
  const anoDeTrabalho = t.anoDeTrabalhoContabil(hoje);
  const anos = [anoDeTrabalho, anoDeTrabalho - 1];
  const ano = anos.includes(Number(params.get('ano'))) ? Number(params.get('ano')) : anoDeTrabalho;
  const esperado = t.mesEsperadoContabil(ano, hoje);
  const repo = useControleContabil();
  const doAno = repo.doAno(ano);
  const lista = useListaDoCadastro();
  const daPessoa = useEmpresasDaPessoa();
  // o executor: só os dois últimos meses esperados do ano (uma leitura por mês, a mesma de Minhas empresas)
  const competencias = useMemo(() => [esperado - 1, esperado].filter(m => m >= 1).map(m => comp(ano, m)), [ano, esperado]);
  const execucoes = useExecucoesDoPeriodo(competencias, 'contabil');

  const [busca, setBusca] = useState('');
  const [situacao, setSituacao] = useState('');
  const [regime, setRegime] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [previa, setPrevia] = useState<PreviaDaImportacao | null>(null);
  const [importando, setImportando] = useState(false);

  // as empresas do Cadastro (o regime do Cadastro, ou o da lista do escritório)
  const porCodigo = useMemo(() => new Map(lista.linhas.filter(l => l.codigo != null).map(l => [l.codigo as number, l])), [lista.linhas]);
  const responsavelDe = (codigo: number) => { const e = porCodigo.get(codigo); return e ? daPessoa.responsavel({ nome: e.nome, codigo }, 'contabil') : ''; };
  const nomeDe = (codigo: number) => porCodigo.get(codigo)?.nomeNaTela || 'Empresa ' + codigo;

  // o que acabou de ser gravado vale até o banco devolver (dois cliques seguidos não perdem o primeiro)
  const gravadas = useRef(new Map<string, t.LinhaDoControleContabil | null>());
  const linhaAgora = (codigo: number): t.LinhaDoControleContabil | null => {
    const id = t.idDaLinhaContabil(ano, codigo);
    const doBanco = doAno.linhas.get(codigo) || null;
    if (gravadas.current.has(id)) {
      const minha = gravadas.current.get(id) as t.LinhaDoControleContabil | null;
      if ((minha === null && !doBanco) || (minha && doBanco && mesmoConteudo(minha, doBanco))) gravadas.current.delete(id);
      else return minha;
    }
    return doBanco;
  };
  const codigosNoControle = new Set<number>(doAno.linhas.keys());
  for (const [id, l] of gravadas.current) {
    const [a, c] = id.split('_').map(Number);
    if (a !== ano) continue;
    if (l) codigosNoControle.add(c); else codigosNoControle.delete(c);
  }

  // a rotina do Contábil concluída no executor, por empresa (as competências do ano)
  const concluidas = new Map<number, string[]>();
  for (const m of execucoes.porMes) {
    for (const ex of m.execucoes) {
      const e = lista.linhas.find(l => l.nome === ex.empresa);
      if (!e || e.codigo == null) continue;
      const rotina = t.rotinaDaEmpresa('contabil', e.codigo) || t.rotinaDo('contabil');
      if (rotina && t.situacaoGeral(ex, rotina) === 'concluida') concluidas.set(e.codigo, [...(concluidas.get(e.codigo) || []), m.competencia]);
    }
  }

  const todas = [...codigosNoControle].map(codigo => {
    const linha = linhaAgora(codigo) || t.linhaContabilEmBranco(ano, codigo);
    const s = t.situacaoContabil(linha, esperado);
    const cad = porCodigo.get(codigo);
    const proximo = Math.min(Math.max(1, linha.feitaAte + 1), Math.max(1, esperado));
    return {
      codigo, nome: nomeDe(codigo), noCadastro: !!cad, regime: cad?.regime || '', responsavel: responsavelDe(codigo),
      linha, ...s, sugestao: linha.pausada ? null : t.sugestaoDoExecutor(ano, linha.feitaAte, concluidas.get(codigo) || []),
      /** a página da empresa no mês que falta (o executor do Contábil) */
      caminho: cad ? caminhoDaEmpresa(cad.rota, comp(ano, proximo)) : '',
    };
  }).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  const q = semAcento(busca.trim());
  const linhas = todas.filter(r => (!q || semAcento(r.nome).includes(q) || String(r.codigo).startsWith(q) || semAcento(r.linha.observacao).includes(q))
    && (!situacao || r.situacao === situacao) && (!regime || r.regime === regime)
    && (!responsavel || (responsavel === '-' ? !r.responsavel : r.responsavel === responsavel)));
  const contar = (s: t.SituacaoContabil) => todas.filter(r => r.situacao === s).length;

  async function gravar(l: t.LinhaDoControleContabil) {
    if (!podeGravar) return;
    const id = t.idDaLinhaContabil(l.ano, l.codigo);
    gravadas.current.set(id, l);
    try { await repo.salvar(l); } catch { gravadas.current.delete(id); toast('Não deu para guardar: confira a internet e tente de novo'); }
  }
  const mudar = (codigo: number, f: (l: t.LinhaDoControleContabil) => t.LinhaDoControleContabil) => {
    const antes = linhaAgora(codigo) || t.linhaContabilEmBranco(ano, codigo);
    const nova = f(antes);
    if (!mesmoConteudo(antes, nova)) void gravar(nova);
  };
  async function gravarVarias(ls: t.LinhaDoControleContabil[]) {
    for (const l of ls) gravadas.current.set(t.idDaLinhaContabil(l.ano, l.codigo), l);
    try { await repo.salvarVarias(ls); return true; } catch {
      for (const l of ls) gravadas.current.delete(t.idDaLinhaContabil(l.ano, l.codigo));
      toast('Não deu para guardar: confira a internet e tente de novo');
      return false;
    }
  }

  // as do Cadastro que ainda não estão no controle (para o + Empresa) e as da pessoa (o Trazer as minhas)
  const foraDoControle = lista.linhas.filter(l => l.codigo != null && !codigosNoControle.has(l.codigo));
  const minhasFora = op ? foraDoControle.filter(l => daPessoa.e({ nome: l.nome, codigo: l.codigo }, 'contabil')) : [];
  const responsaveis = [...new Set(todas.map(r => r.responsavel).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const regimes = [...new Set(todas.map(r => r.regime).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  return {
    carregando: !doAno.carregada || lista.carregando,
    falhou: doAno.falhou,
    exemplos: repo.exemplos,
    podeGravar,
    ano, anos, setAno: (a: number) => { const n = new URLSearchParams(params); n.set('ano', String(a)); setParams(n); },
    esperado, rotuloEsperado: esperado ? t.rotuloDoMesFeito(esperado) : '',
    meses: t.MESES_DO_CONTROLE.map((m, i) => ({ valor: i + 1, rotulo: m })),
    filtros: {
      busca, setBusca, situacao, setSituacao, regime, setRegime, responsavel, setResponsavel,
      situacoes: t.SITUACOES_CONTABEIS, regimes,
      responsaveis: [...responsaveis.map(r => ({ valor: r, rotulo: r })), { valor: '-', rotulo: 'Sem responsável' }],
      algum: !!(busca || situacao || regime || responsavel),
      limpar: () => { setBusca(''); setSituacao(''); setRegime(''); setResponsavel(''); },
    },
    total: todas.length, linhas,
    resumo: { emDia: contar('em-dia'), atrasadas: contar('atrasada'), naoIniciadas: contar('nao-iniciada'), pausadas: contar('pausada') },

    mudarMes(codigo: number, mes: number) { mudar(codigo, l => ({ ...l, feitaAte: Math.max(0, Math.min(12, mes)) })); },
    aceitarSugestao(codigo: number) { const r = todas.find(x => x.codigo === codigo); if (r?.sugestao) mudar(codigo, l => ({ ...l, feitaAte: r.sugestao as number })); },
    mudarObservacao(codigo: number, texto: string) { mudar(codigo, l => ({ ...l, observacao: texto.trim().slice(0, t.MAX_OBSERVACAO_CONTABIL) })); },
    /** não acompanhar (com o motivo) ou voltar a acompanhar ('') */
    pausar(codigo: number, motivo: string) { mudar(codigo, l => ({ ...l, pausada: motivo.trim().slice(0, t.MAX_MOTIVO_PAUSA) })); },
    async tirar(codigo: number) {
      if (!podeGravar) return;
      const id = t.idDaLinhaContabil(ano, codigo);
      gravadas.current.set(id, null);
      try { await repo.remover(ano, codigo); } catch { gravadas.current.delete(id); toast('Não deu para tirar: confira a internet e tente de novo'); }
    },

    /** as empresas do Cadastro fora do controle, para o + Empresa ("código — nome") */
    paraAdicionar: foraDoControle.map(l => l.codigo + ' — ' + l.nomeNaTela),
    /** + Empresa: o código, "código — nome" ou o nome inteiro; true quando entrou */
    adicionar(texto: string): boolean {
      const codigo = Number(/^\s*(\d+)/.exec(texto)?.[1]);
      const nome = semAcento(texto.trim());
      const e = foraDoControle.find(l => l.codigo === codigo) || (nome ? foraDoControle.find(l => semAcento(l.nomeNaTela) === nome || semAcento(l.nome) === nome) : undefined);
      if (!e || e.codigo == null) { toast(codigosNoControle.has(codigo) ? 'A empresa ' + codigo + ' já está no controle' : 'Escolha uma empresa do Cadastro na lista'); return false; }
      void gravar(t.linhaContabilEmBranco(ano, e.codigo));
      return true;
    },
    /** as empresas em que a pessoa é a responsável do Contábil no Cadastro e que ainda não estão no controle */
    minhasFora: minhasFora.length,
    async trazerMinhas() {
      if (!minhasFora.length) return;
      if (await gravarVarias(minhasFora.map(l => t.linhaContabilEmBranco(ano, l.codigo as number)))) toast(minhasFora.length + (minhasFora.length === 1 ? ' empresa entrou' : ' empresas entraram') + ' no controle');
    },
    /** o ano vazio: copiar as empresas do ano anterior (sem os meses; a pendência e o não acompanhar vêm junto) */
    async copiarDoAnoAnterior() {
      try {
        const antes = await repo.lerAno(ano - 1);
        if (!antes.length) { toast('O controle de ' + (ano - 1) + ' está vazio'); return; }
        const novas = antes.filter(l => !codigosNoControle.has(l.codigo)).map(l => ({ ...t.linhaContabilEmBranco(ano, l.codigo), observacao: l.observacao, pausada: l.pausada }));
        if (novas.length && await gravarVarias(novas)) toast(novas.length + ' empresas copiadas de ' + (ano - 1));
      } catch { toast('Não deu para ler o controle de ' + (ano - 1)); }
    },

    // ---- a importação da planilha ----
    previa, importando,
    async lerArquivo(arquivo: File) {
      if (!podeGravar) return;
      const leitura = t.lerPlanilhaDoControleContabil(await arquivo.arrayBuffer());
      if (leitura.erro) { toast(leitura.erro); return; }
      if (!leitura.linhas.length) { toast('Nenhuma empresa com código na planilha'); return; }
      const existentes = new Map<number, t.LinhaDoControleContabil>();
      for (const c of codigosNoControle) { const l = linhaAgora(c); if (l) existentes.set(c, l); }
      const plano = t.planoDaImportacaoContabil({
        ano, lidas: leitura.linhas, existentes,
        empresas: lista.linhas.filter(l => l.codigo != null).map(l => ({ codigo: l.codigo as number, nome: l.nomeNaTela, regime: l.regime })),
      });
      setPrevia({ arquivo: arquivo.name, lidas: leitura.linhas.length, plano, ignoradas: leitura.ignoradas, nomeDe, antes: existentes });
    },
    fecharPrevia: () => { if (!importando) setPrevia(null); },
    async confirmarImportacao() {
      if (!previa || !podeGravar) return;
      setImportando(true);
      const ok = !previa.plano.gravar.length || await gravarVarias(previa.plano.gravar);
      setImportando(false);
      if (!ok) return;
      toast(previa.plano.gravar.length ? previa.plano.gravar.length + (previa.plano.gravar.length === 1 ? ' empresa atualizada' : ' empresas atualizadas') + ' pela planilha' : 'Nada mudou: o nads já estava igual à planilha');
      setPrevia(null);
    },

    exportar() {
      const cabecalho = ['Nº', 'Empresa', 'Regime', 'Responsável', 'Feita até', 'Situação', 'Observações', 'Não acompanhar', 'Atualizado por', 'Atualizado em'];
      const valores = linhas.map(r => [
        r.codigo, r.nome, r.regime, r.responsavel, r.linha.feitaAte ? t.rotuloDoMesFeito(r.linha.feitaAte) : '-', r.rotulo, r.linha.observacao, r.linha.pausada,
        r.linha.atualizadoPor || '', r.linha.atualizadoEm ? new Date(r.linha.atualizadoEm).toLocaleString('pt-BR') : '',
      ]);
      return { bytes: t.planilhaXlsx('Controle Forestry ' + ano, cabecalho, valores), nome: 'Controle Forestry ' + ano + '.xlsx' };
    },
    /** o nome para mostrar de uma empresa do Cadastro (a janela da prévia) */
    nomeDe,
  };
}
export type VmControleDoContabil = ReturnType<typeof useControleDoContabil>;
