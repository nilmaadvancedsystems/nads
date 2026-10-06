// ViewModel da etapa Exclusão do Creditor (Vitor, 05/10/2026): depois de importar o .xls no Alterdata (que quebra o
// total do banco em partes pequenas), a pessoa exclui lá o lançamento do total e reimporta aqui o razão da conta banco;
// o nads confere, dia a dia e no fim do período, se o saldo do razão bate com o do extrato já importado (Extrator).
// O banco é o do Cadastro ligado à conta banco do Creditor (a conta contábil); o razão novo sobrepõe o daquelas datas.
import { creditor as cr, extrator as x } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useState } from 'react';
import { useAplicar, useCadastroDaEmpresa, useEmpresa } from '../../../extrator/dados/repo';
import { useDadosDeTesteNaTarefa } from '../../../../../../comum/ponte';
import { modoDesenvolvedor } from '../../../../../../comum/modoDesenvolvedor';
import { useSessao } from '../../casca/sessao';

const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function useExclusao() {
  const s = useSessao();
  const { aviso, modal } = useRetorno();
  const nome = s.empresa.nome;
  const emp = useEmpresa(nome);
  const aplicar = useAplicar(nome);
  const { cadastro } = useCadastroDaEmpresa(nome, s.empresa.codigo);
  const meses = cr.mesesDaCompetencia(s.estado.competencia);
  const contaBanco = s.contas.resolvidas.contas.banco;
  const { bancos, primeiro } = x.bancosDaEmpresaNa(emp, cadastro, s.empresa.codigo, meses[meses.length - 1] || '');
  // o banco da conta banco do Creditor (no Cadastro, a conta contábil da conta bancária); um banco só: ele
  const ligado = cadastro?.bancos?.find(b => b.contaContabil === contaBanco)?.id;
  const banco = bancos.find(b => b.id === ligado) || (bancos.length === 1 ? bancos[0] : null);
  const saldo = banco && meses.length ? x.saldoDoPeriodo(emp, banco.id, primeiro, meses) : null;
  const [lendo, setLendo] = useState(false);
  // as partes do .xls (cada lançamento que mexe na conta banco) têm de estar no razão: com o total ainda lá, faltam
  const iso = (d: string) => d.slice(6, 10) + '-' + d.slice(3, 5) + '-' + d.slice(0, 2);
  const partes = s.d.lancamentos.filter(l => l.debito === contaBanco || l.credito === contaBanco)
    .map(l => ({ data: iso(l.data), valor: Math.round(l.valor * 100), historico: l.historico }));
  // o razão importado aqui (Vitor, 05/10/2026: "tire o Ok antes do usuário upar o razão"): só ele conta
  const doPasso = s.estado.razaoDaExclusao;
  const temRazao = !!doPasso && doPasso.ids.some(id => emp.arquivos.some(a => a.id === id)) && !!saldo?.completo;
  const faltam = banco && temRazao ? x.partesForaDoRazao(emp, banco.id, primeiro, meses, partes) : [];

  // bateu: a Tarefa pode seguir (a setinha libera)
  const bate = temRazao && !!saldo?.bate && partes.length > 0 && faltam.length === 0;
  useEffect(() => {
    if (s.estado.bancoConferido !== bate) s.mudar(e => ({ ...e, bancoConferido: bate }));
  }, [bate, s]);

  /** O razão novo da conta banco: sobrepõe o que estava nas mesmas datas (a reimportação) e fica com o banco certo. */
  function aplicarRazao(lido: x.ArquivoLido) {
    if (!banco) return;
    const doBanco = (a: x.ArquivoImportado) => x.bancoDoArquivo(a, primeiro) === banco.id;
    const novos: string[] = [];
    aplicar(e => {
      const agora = { ...e, arquivos: e.arquivos.filter(doBanco) };
      const modo = x.jaTemNoPeriodo(agora, 'sistema', [lido]) ? 'sobrepor' : 'primeira';
      const res = x.importar(agora, 'sistema', [lido], modo, new Date(), novoId);
      const antes = new Set(agora.arquivos.map(a => a.id));
      const outros = e.arquivos.filter(a => !doBanco(a));
      novos.splice(0, novos.length, ...res.empresa.arquivos.filter(a => !antes.has(a.id)).map(a => a.id));
      return { ...res.empresa, arquivos: [...outros, ...res.empresa.arquivos.map(a => (antes.has(a.id) ? a : { ...a, banco: banco.id }))] };
    });
    s.mudar(e => ({ ...e, razaoDaExclusao: { ids: novos, nome: lido.nome } }));
    aviso({ tom: 'ok', titulo: 'Razão importado', texto: banco.nome + ' · ' + lido.lancamentos.length + ' lançamento(s)' });
  }

  async function importarRazao(f: File | undefined) {
    if (!f || !banco) return;
    setLendo(true);
    try {
      const lido = await x.lerArquivo(f.name, new Uint8Array(await f.arrayBuffer()), 'sistema');
      if (lido.erro || !lido.lancamentos.length) { aviso({ tom: 'erro', titulo: 'Nada para importar', texto: f.name + ': ' + (lido.erro || 'nenhum lançamento') }); return; }
      aplicarRazao(lido);
    } finally { setLendo(false); }
  }

  // o ⚡ do modo desenvolvedor na Tarefa: o razão de teste feito do extrato (com as partes, dá Ok; com o total, faltam as partes)
  const comSinal = s.d.lancamentos.filter(l => l.debito === contaBanco || l.credito === contaBanco)
    .map(l => ({ data: iso(l.data), valor: Math.round(l.valor * 100) * (l.debito === contaBanco ? 1 : -1), historico: l.historico }));
  const teste = useDadosDeTesteNaTarefa(modoDesenvolvedor() && banco && meses.length && !temRazao ? [
    { id: 'partes', rotulo: 'Razão de teste com as partes (dá Ok)' },
    { id: 'total', rotulo: 'Razão de teste com o total (faltam as partes)' },
  ] : [], id => {
    if (banco) aplicarRazao(x.razaoDeTesteDaExclusao(emp, banco.id, primeiro, meses, id === 'partes' ? comSinal : null));
  });

  /** O check do razão (como na Importação): exclui o razão importado aqui (pergunta antes). */
  async function excluirRazao() {
    if (!doPasso) return;
    const ok = await modal<boolean>({
      icone: 'alert', titulo: 'Excluir a importação?',
      botoes: [{ rotulo: 'Excluir', valor: true, variante: 'btn-danger' }, { rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }],
    });
    if (!ok) return;
    aplicar(e => doPasso.ids.reduce((acc, id) => x.excluirArquivo(acc, id, new Date()), e));
    s.mudar(e => ({ ...e, razaoDaExclusao: undefined, bancoConferido: false }));
    aviso({ tom: 'ok', titulo: 'Importação excluída', texto: 'Razão da conta ' + contaBanco });
  }

  return {
    competencia: cr.rotuloCompetencia(s.estado.competencia),
    contaBanco,
    banco: banco ? { id: banco.id, nome: banco.nome, marca: banco.marca, conta: [banco.agencia && 'Ag. ' + banco.agencia, banco.conta && 'C/C ' + banco.conta].filter(Boolean).join(' · ') } : null,
    lendo,
    /** o razão do banco no período já está aqui (sem ele, só o importar) */
    temRazao,
    nomeDoRazao: doPasso?.nome || '',
    excluirRazao: () => { void excluirRazao(); },
    bate,
    /** o resumo no meio da linha: o saldo final do extrato e o do razão */
    resumo: temRazao && saldo ? ['Extrato ' + x.reaisBR(saldo.extrato), 'Razão ' + x.reaisBR(saldo.razao)] : [],
    dias: (temRazao && saldo ? saldo.dias : []).map(d => ({ data: x.dataBR(d.data), extrato: x.reaisBR(d.extrato), razao: x.reaisBR(d.razao), diferenca: x.reaisBR(d.diferenca) })),
    diferencaFinal: temRazao && saldo && !saldo.bate ? x.reaisBR(saldo.razao - saldo.extrato) : '',
    /** as partes do .xls do Creditor que não estão no razão (o total ainda não foi trocado no Alterdata) */
    partesFaltando: faltam.map(p => ({ data: x.dataBR(p.data), valor: x.reaisBR(p.valor), historico: p.historico })),
    importarRazao: (f: File | undefined) => { void importarRazao(f); },
    /** o ⚡ do modo desenvolvedor na linha */
    teste,
  };
}
