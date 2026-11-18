// ViewModel dos pagamentos do pró-labore no checklist da Contabilização da Folha (Vitor, 14/10/2026): a pessoa importa o
// razão do Pró-labore a pagar (XLS da conciliação do Alterdata) e o nads monta os pagamentos que faltam para ele zerar —
// D Pró-labore a pagar, C a conta escolhida, H "Pagamento de pro-labore mm/aaaa SÓCIO" — e baixa o .xls de importação do
// Alterdata (o padrão de 10 colunas do Alterdata). Fica só na tela.
import { creditor, empresas, formatos, releitura, tarefas as t } from '@nads/core';
import { baixarBytes, useRetorno } from '@nads/ui';
import { useMemo, useState } from 'react';
import { useContasDoBalancete } from '../../etapas/conferencia/importadosNaEtapa';
import { useCadastro } from '../../dados/repo';
import { useModelosDeHistorico } from '../../dados/useModelosDeHistorico';
import { useOperador } from '../../casca/operador';
import { nomeDoLote } from '../../../../comum/importarNoAlterdata';
import { rotuloDaImportacao, useContabilDaEmpresa } from '../../../../comum/contabilDaEmpresa';

/** contaDoItem: a conta do item do checklist ("60005 — Pro-labore a Pagar"), a do débito. */
export function usePagamentosDoProLabore(empresa: string, codigo: number | null, contaDoItem: string, meses: readonly string[] = []) {
  const { aviso } = useRetorno();
  const [proprio, setRazao] = useState<{ arquivo: string; razao: t.RazaoDaConta } | null>(null);
  // o da Importação (o upload único dos razões; o Diário preenche ali), quando a etapa não tem o próprio
  const contabil = useContabilDaEmpresa(empresa, codigo);
  const daImportacao = contabil.razaoDoTipo('prolabore');
  const impArquivo = daImportacao ? rotuloDaImportacao(daImportacao) : '';
  const impRazao = daImportacao?.razao;
  const razao = useMemo(() => proprio || (impRazao ? { arquivo: impArquivo, razao: impRazao } : null), [proprio, impArquivo, impRazao]);
  // só a conta do crédito e o dia útil do pagamento (Vitor, 14/10/2026: "não precisa apresentar, só pedir a conta e se vai
  // ser no 1, 2, 3, 4 ou 5 dia útil de cada mês"); a lista do razão não aparece
  // salvos na empresa (Cadastro; Vitor, 14/10/2026: "deixa ele salvo na empresa"); a conta, ao sair do campo
  const vivo = useCadastro(empresa, codigo);
  const cadastro = vivo.carregada ? vivo.cadastro : null;
  const op = useOperador().operador;
  const salvo = cadastro?.proLabore || {};
  const [digitada, setDigitada] = useState<string | null>(null);
  const conta = digitada ?? salvo.contaCredito ?? '';
  const diaUtil = salvo.diaUtil || 5;
  const gravar = (mudar: { contaCredito?: string; diaUtil?: number }) => {
    if (!cadastro) return;
    const novo = empresas.cadastro.definirPagamentoDoProLabore(cadastro, mudar, op?.nome || 'Tarefa', new Date());
    if (novo !== cadastro) vivo.salvar(novo);
  };
  const contas = useContasDoBalancete(empresa);
  const plano = useMemo(() => (contas || []).filter(c => !c.sintetica).map(c => ({ codigo: c.codigo, nome: c.nome })), [contas]);
  // a conta do pagamento: só o caixa e os bancos conta movimento do plano (Vitor, 18/11/2026: "voce pega apenas o caixa e contas
  // do banco movimento, do plano de contas para selecionar"): a analítica embaixo da sintética Caixa ou Bancos (na ordem do
  // balancete), ou com caixa/banco no nome; aplicação, empréstimo e financiamento ficam de fora
  const deDinheiro = useMemo(() => {
    const fora = /aplica|empr[eé]stimo|financiamento|consórcio|consorcio|cap\.? de giro|capital de giro/i;
    const ordem = [...(contas || [])].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
    let pai = '';
    const achadas: { codigo: string; nome: string }[] = [];
    for (const c of ordem) {
      if (c.sintetica) { pai = c.nome; continue; }
      const doPai = /^caixa\b|caixa geral|^bancos?\b|conta movimento/i.test(pai) && !fora.test(pai);
      const doNome = /^caixa\b|banco|conta movimento/i.test(c.nome);
      if ((doPai || doNome) && !fora.test(c.nome) && (!c.grupo || /ativo/i.test(c.grupo))) achadas.push({ codigo: c.codigo, nome: c.nome });
    }
    return achadas;
  }, [contas]);
  const debito = contaDoItem.split(' — ')[0].trim();
  const modelos = useModelosDeHistorico();
  const pagamentos = useMemo(() => (razao ? t.pagamentosDoProLabore(razao.razao, modelos) : []), [razao, modelos]);

  async function importar(f: File | null) {
    if (!f) return;
    try {
      setRazao({ arquivo: f.name, razao: releitura.lerRazao(await f.arrayBuffer(), f.name) });
    } catch (e) {
      aviso({ tom: 'erro', titulo: 'Não consegui ler o razão do pró-labore', texto: e instanceof Error ? e.message : String(e) });
    }
  }

  /** as linhas do .xls (D Pró-labore a pagar, C a conta escolhida): as mesmas no Baixar e no Importar no Alterdata */
  const linhasDoArquivo = () => pagamentos.map(p => ({
    automatico: '', data: t.dataDoPagamentoDoProLabore(p.competencia, diaUtil), debito, credito: conta, codHistorico: '', historico: p.historico, valor: p.valor,
    documento: '', tipo: 'principal' as const, tituloId: 0,
  }));
  const planilha = () => creditor.planilhaDeImportacao(linhasDoArquivo());

  // o pró-labore mês a mês (18/11/2026: "coloca um saldo mensal embaixo para eu ver quais pagamentos faltam... pago ou nao pago")
  const chaveDosMeses = meses.join(',');
  const porMes = useMemo(() => (razao && meses.length ? t.mesesDoProLabore(razao.razao, meses) : null), [razao, chaveDosMeses]); // eslint-disable-line react-hooks/exhaustive-deps
  const dataBR = (iso: string) => iso.slice(8, 10) + '/' + iso.slice(5, 7);
  const reais = (n: number) => formatos.reais(n);

  return {
    /** a grade dos meses: pago, parcial, falta ou sem pró-labore, com os valores (null = sem razão) */
    meses: porMes ? porMes.meses.map(m => ({
      mes: m.mes, rotulo: t.rotuloNumericoCompetencia(m.mes), situacao: m.situacao,
      provisao: m.provisao ? reais(m.provisao) : '', inss: m.inss ? reais(m.inss) : '', liquido: m.liquido ? reais(m.liquido) : '',
      pago: m.pago ? reais(m.pago) : '', falta: m.falta ? reais(m.falta) : '', saldo: m.saldo === null ? '' : reais(m.saldo),
      pagoEm: m.pagoEm.map(dataBR).join(', '),
    })) : null,
    /** o saldo de antes do razão que ainda falta pagar ('' = nada) */
    faltaDeAntes: porMes && porMes.anterior.falta > 0.005 ? reais(porMes.anterior.falta) : '',
    /** quanto falta no período e em quantos meses */
    resumoDosMeses: porMes ? (() => {
      const abertos = porMes.meses.filter(m => m.falta > 0.005);
      return abertos.length ? abertos.length + (abertos.length === 1 ? ' mês' : ' meses') + ' sem pagar tudo · falta ' + reais(abertos.reduce((x, m) => x + m.falta, 0)) : 'Tudo pago no período';
    })() : '',
    temRazao: !!razao, arquivo: razao?.arquivo || '',
    importar,
    remover: () => { setRazao(null); if (!proprio && daImportacao) contabil.tirarRazao(daImportacao.conta); },
    /** o Diário do pró-labore (a Importação preenche; o razão próprio desta etapa, se houver, sai) */
    usarDiario: () => { if (contabil.usarDiarioDoTipo('prolabore', 'Pró-labore a pagar')) setRazao(null); },
    contas: plano, contasDePagamento: deDinheiro.length ? deDinheiro : plano,
    nomeDaConta: (deDinheiro.find(c => c.codigo === conta) || plano.find(c => c.codigo === conta))?.nome || '',
    /** escolheu no menu: grava na empresa */
    escolherConta: (codigo: string) => { setDigitada(null); gravar({ contaCredito: codigo }); },
    conta, digitarConta: (v: string) => setDigitada(v.replace(/\D/g, '')),
    /** ao sair do campo (ou no Enter): grava a conta na empresa */
    salvarConta: () => { if (digitada !== null) { gravar({ contaCredito: digitada }); setDigitada(null); } },
    diaUtil, escolherDiaUtil: (n: number) => gravar({ diaUtil: n }),
    /** quantos pagamentos faltam para o razão zerar e o total (só no título do botão) */
    qtd: pagamentos.length, total: formatos.reais(pagamentos.reduce((s, p) => s + p.valor, 0)),
    podeExportar: pagamentos.length > 0 && !!conta && !!debito,
    /** o que o "Importar no Alterdata" manda: a mesma planilha do Baixar (as mesmas linhas) */
    importacao: {
      codigo, empresa, origem: 'prolabore', lote: nomeDoLote('Pró-labore', linhasDoArquivo().map(l => l.data)),
      planilha: () => (pagamentos.length ? { bytes: planilha(), linhas: pagamentos.length } : null),
    },
    /** o .xls de importação do Alterdata: D Pró-labore a pagar, C a conta escolhida, no dia útil escolhido do mês seguinte */
    baixarXls: () => {
      const bytes = planilha();
      baixarBytes(bytes, 'pagamentos-pro-labore-' + empresa.split(' ')[0] + '.xls', creditor.TIPO_XLS);
    },
  };
}

export type PagamentosDoProLabore = ReturnType<typeof usePagamentosDoProLabore>;
