// ViewModel da janela de um lançamento do LCDPR. Desde 11/11/2026 ("preciso que no importador tenha a opção de lancar na
// mão algum tipo de lançamento, e para abrir uma tela flutuante com o lançamento a ser feito com as opçoes de conta e tudo
// que tem, puxado via balancete igualmente o alterdata é") é a "Lançamentos (Cadastramento)" do LCDPR do Alterdata: data,
// valor, lançamento automático (a categoria), conta devedora e credora com a lupa (a pesquisa no plano de contas da
// empresa, o que veio do Alterdata/balancete no Cadastro; sem ele, o plano do LCDPR), histórico padrão com a lupa,
// documento, imóvel com a lupa, os tipos e o CPF/CNPJ. Serve para o lançamento novo (id 'novo') e para corrigir o que veio
// do SIEG ou de um relatório. A conta credora escolhida fica lembrada para o fornecedor.
import { formatos, lcdpr } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { useCadastro, useLcdpr } from '../../../dados/repo';
import { useRegrasDoLcdpr } from './useRegrasDoLcdpr';
import { lembrarContasDe, lerSessao, mesDoLancamento, mudarMes, tirarLancamentos, trocarLancamentos, useSessaoDoLcdpr } from './useSessaoDoLcdpr';

/** Os campos com a lupa. */
export type CampoDaPesquisa = 'contaDeved' | 'contaCred' | 'codHist' | 'imovel';

const TITULO_DA_PESQUISA: Record<CampoDaPesquisa, string> = {
  contaDeved: 'Conta devedora', contaCred: 'Conta credora', codHist: 'Histórico padrão', imovel: 'Imóvel',
};
const ORIGEM: Record<lcdpr.OrigemDoDocumento, string> = { NF: 'Nota fiscal', CTe: 'CT-e', Manual: 'Lançamento à mão' };
/** quantas linhas a pesquisa mostra de uma vez (o resto aparece digitando) */
const NA_PESQUISA = 300;

const opcoes = (lista: readonly lcdpr.CodigoDescricao[]) => lista.map(t => ({ valor: t.codigo, rotulo: t.codigo + ' - ' + t.descricao }));

export function useJanelaDoLancamento(id: number | 'novo', fechar: () => void) {
  const r = useRegrasDoLcdpr();
  const s = useSessaoDoLcdpr();
  const { modal, toast, aviso } = useRetorno();
  const falhou = (msg: string) => aviso({ tom: 'erro', titulo: 'Não gravou o mês do LCDPR', texto: msg });
  const existente = id === 'novo' ? null : s.lancamentos.find(x => x.id === id) || null;
  const [rascunho, setRascunho] = useState<lcdpr.RascunhoDoLancamento>(() => (existente ? lcdpr.rascunhoDoLancamento(existente) : lcdpr.rascunhoNovo(r.config)));
  const [pesquisa, setPesquisa] = useState<{ campo: CampoDaPesquisa; termo: string } | null>(null);
  const [tentou, setTentou] = useState(false);

  // o plano de contas da empresa (o Cadastro: o do Alterdata, ou o balancete que a Conferência guardou)
  const cad = useCadastro(s.nome, s.empresa);
  const planoDaEmpresa = cad.plano?.contas ?? [];
  // o que o produtor já usa no Alterdata (a planilha do movimento importada na Configuração)
  const repoLcdpr = useLcdpr();
  const aprendidos = s.empresa != null ? repoLcdpr.cadastros(s.empresa).cadastros : lcdpr.cadastrosVazios();
  const contas = lcdpr.contasDaPesquisa(r.config, planoDaEmpresa, aprendidos.contas);
  const historicos = lcdpr.historicosDaPesquisa(r.config, aprendidos.historicos);
  const imoveis = lcdpr.imoveisDaPesquisa(r.config);
  const listaDe = (c: CampoDaPesquisa) => (c === 'codHist' ? historicos : c === 'imovel' ? imoveis : contas);
  // o novo vai para o mês da data (um dos abertos); o que já existe fica no mês dele
  const problemas = lcdpr.problemasDoRascunho(rascunho, existente ? [mesDoLancamento(existente.id)] : s.meses);

  const mudar = (campo: keyof lcdpr.RascunhoDoLancamento, v: string) => setRascunho(x => lcdpr.mudarNoRascunho(x, campo, v, r.config, historicos));

  return {
    novo: id === 'novo',
    /** o lançamento sumiu do mês (desfeito por outra pessoa) */
    sumiu: id !== 'novo' && !existente,
    origem: existente ? ORIGEM[existente.origem] : ORIGEM.Manual,
    revisar: !!existente?.revisar,
    ncm: existente?.ncm || '',
    podeExcluir: existente?.origem === 'Manual',
    rascunho,
    mudar,
    /** o plano das lupas de conta: o da empresa (do Alterdata) ou o do LCDPR */
    origemDasContas: planoDaEmpresa.length ? 'Plano de contas da empresa (Alterdata)' : 'Plano de contas do LCDPR (a empresa ainda não tem o plano do Alterdata no Cadastro)',
    nomes: {
      contaDeved: lcdpr.nomeNaPesquisa(contas, rascunho.contaDeved),
      contaCred: lcdpr.nomeNaPesquisa(contas, rascunho.contaCred),
      codHist: lcdpr.nomeNaPesquisa(historicos, rascunho.codHist),
      imovel: lcdpr.nomeNaPesquisa(imoveis, rascunho.imovel),
    },
    automaticos: r.config.categorias.map(c => c.nome),
    /** o "Pago com" (como o Payment account do QuickBooks e a Conta bancária do Aegro): o Caixa e os bancos, com o logo */
    pagamentos: lcdpr.contasDePagamento(r.config).map(c => ({ codigo: c.codigo, nome: c.nome, marca: lcdpr.marcaDaConta(c.nome), atual: c.codigo === rascunho.contaCred })),
    pagarCom: (codigo: string) => mudar('contaCred', codigo),
    /** a conta credora que não é das de pagamento (escolhida pela lupa) */
    pagamentoFora: !!rascunho.contaCred && !lcdpr.contasDePagamento(r.config).some(c => c.codigo === rascunho.contaCred),
    /** o resumo ao lado: como o lançamento vai para a planilha do LCDPR */
    resumo: {
      valor: formatos.reais(lcdpr.numeroDaCelula(rascunho.valor)),
      data: lcdpr.dataDaCelula(rascunho.data) ? rascunho.data : '',
      debito: rascunho.contaDeved ? rascunho.contaDeved + ' · ' + (lcdpr.nomeNaPesquisa(contas, rascunho.contaDeved) || 'conta fora da lista') : '',
      credito: rascunho.contaCred ? rascunho.contaCred + ' · ' + (lcdpr.nomeNaPesquisa(contas, rascunho.contaCred) || 'conta fora da lista') : '',
      historico: rascunho.historico.trim(),
      imovel: rascunho.imovel ? rascunho.imovel + ' · ' + (lcdpr.nomeNaPesquisa(imoveis, rascunho.imovel) || '?') : '',
      tipos: [r.config.tipoDoc.find(t => t.codigo === rascunho.tipoDoc)?.descricao, r.config.tipoLanc.find(t => t.codigo === rascunho.tipoLanc)?.descricao].filter(Boolean).join(' · '),
      fornecedor: [rascunho.fornecedor.trim(), lcdpr.cpfCnpjFormatado(rascunho.cnpj)].filter(Boolean).join(' · '),
    },
    /** o que ainda falta (sempre, para o resumo; o aviso vermelho só depois de tentar gravar) */
    faltam: problemas,
    escolherAutomatico: (nome: string) => setRascunho(x => lcdpr.aplicarAutomatico(x, nome, r.config)),
    tiposDoc: opcoes(r.config.tipoDoc),
    tiposLanc: opcoes(r.config.tipoLanc),

    // a lupa
    pesquisa: pesquisa && (() => {
      const achados = lcdpr.pesquisar(listaDe(pesquisa.campo), pesquisa.termo);
      return {
        titulo: 'Pesquisa de ' + TITULO_DA_PESQUISA[pesquisa.campo],
        /** os títulos das colunas (o histórico mostra a conta em que costuma cair) */
        cabeca: pesquisa.campo === 'codHist' ? ['Código', 'Conta usual', 'Histórico', ''] : pesquisa.campo === 'imovel' ? ['Código', '', 'Imóvel', ''] : ['Código', 'Classificação', 'Descrição', 'Tipo'],
        termo: pesquisa.termo,
        total: achados.length,
        itens: achados.slice(0, NA_PESQUISA).map(i => ({
          ...i, atual: i.codigo === rascunho[pesquisa.campo],
          tipo: pesquisa.campo === 'contaDeved' || pesquisa.campo === 'contaCred' ? (i.sintetica ? 'Sintética' : 'Analítica') : '',
        })),
      };
    })(),
    abrirPesquisa: (campo: CampoDaPesquisa) => setPesquisa({ campo, termo: '' }),
    setTermo: (termo: string) => setPesquisa(p => (p ? { ...p, termo } : p)),
    fecharPesquisa: () => setPesquisa(null),
    escolher(codigo: string) {
      if (!pesquisa) return;
      if (pesquisa.campo === 'codHist') setRascunho(x => lcdpr.aplicarHistoricoPadrao(x, codigo, historicos));
      else mudar(pesquisa.campo, codigo);
      setPesquisa(null);
    },

    /** o que falta (só depois de tentar gravar) */
    problemas: tentou ? problemas : [],
    salvar() {
      if (problemas.length) { setTentou(true); return; }
      const atual = existente && lerSessao().lancamentos.find(x => x.id === existente.id);
      if (existente && !atual) { fechar(); return; }
      if (atual) {
        const novo = lcdpr.lancamentoDoRascunho(rascunho, r.config, atual);
        trocarLancamentos([novo], falhou);
        if (novo.contaCred !== atual.contaCred) lembrarContasDe([novo], r.atual().config.contaCredoraPadrao).catch((e: Error) => falhou(e.message));
      } else {
        const criado: { l?: lcdpr.Lancamento } = {};
        const mes = lcdpr.dataDaCelula(rascunho.data).slice(0, 7);
        mudarMes(mes, m => {
          const l = lcdpr.lancamentoDoRascunho(rascunho, r.config, { id: lcdpr.proximoIdDoMes(m.lancamentos, mes) });
          criado.l = l;
          return { ...m, lancamentos: [...m.lancamentos, l] };
        }, falhou);
        if (criado.l) {
          lembrarContasDe([criado.l], r.atual().config.contaCredoraPadrao).catch((e: Error) => falhou(e.message));
          toast('Lançamento incluído no mês.');
        }
      }
      fechar();
    },
    /** tira do mês o lançamento feito à mão */
    async excluir() {
      if (!existente || existente.origem !== 'Manual') return;
      const ok = await modal({
        icone: 'alert', titulo: 'Excluir este lançamento?', texto: 'Ele sai do mês e da planilha.',
        botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Excluir', valor: true, variante: 'btn-danger' }],
      });
      if (!ok) return;
      tirarLancamentos([existente.id], falhou);
      toast('Lançamento excluído.');
      fechar();
    },
  };
}
