// ViewModel da etapa Exclusão do Creditor (Vitor, 05/10/2026): depois de importar o .xls no Alterdata (que quebra o
// total do banco em partes pequenas), a pessoa exclui lá o lançamento do total e reimporta aqui o razão da conta banco;
// o nads confere, dia a dia e no fim do período, se o saldo do razão bate com o do extrato já importado (Extrator).
// O banco é o do Cadastro ligado à conta banco do Creditor (a conta contábil); o razão novo sobrepõe o daquelas datas.
import { creditor as cr, extrator as x } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useState } from 'react';
import { useAplicar, useCadastroDaEmpresa, useEmpresa } from '../../../extrator/dados/repo';
import { useSessao } from '../../casca/sessao';

const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function useExclusao() {
  const s = useSessao();
  const { aviso } = useRetorno();
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
  const faltam = banco && saldo?.completo ? x.partesForaDoRazao(emp, banco.id, primeiro, meses, partes) : [];

  // bateu: a Tarefa pode seguir (a setinha libera)
  const bate = !!saldo?.completo && saldo.bate && partes.length > 0 && faltam.length === 0;
  useEffect(() => {
    if (s.estado.bancoConferido !== bate) s.mudar(e => ({ ...e, bancoConferido: bate }));
  }, [bate, s]);

  /** O razão novo da conta banco: sobrepõe o que estava nas mesmas datas (a reimportação) e fica com o banco certo. */
  async function importarRazao(f: File | undefined) {
    if (!f || !banco) return;
    setLendo(true);
    try {
      const lido = await x.lerArquivo(f.name, new Uint8Array(await f.arrayBuffer()), 'sistema');
      if (lido.erro || !lido.lancamentos.length) { aviso({ tom: 'erro', titulo: 'Nada para importar', texto: f.name + ': ' + (lido.erro || 'nenhum lançamento') }); return; }
      const doBanco = (a: x.ArquivoImportado) => x.bancoDoArquivo(a, primeiro) === banco.id;
      aplicar(e => {
        const agora = { ...e, arquivos: e.arquivos.filter(doBanco) };
        const modo = x.jaTemNoPeriodo(agora, 'sistema', [lido]) ? 'sobrepor' : 'primeira';
        const res = x.importar(agora, 'sistema', [lido], modo, new Date(), novoId);
        const antes = new Set(agora.arquivos.map(a => a.id));
        const outros = e.arquivos.filter(a => !doBanco(a));
        return { ...res.empresa, arquivos: [...outros, ...res.empresa.arquivos.map(a => (antes.has(a.id) ? a : { ...a, banco: banco.id }))] };
      });
      aviso({ tom: 'ok', titulo: 'Razão importado', texto: banco.nome + ' · ' + lido.lancamentos.length + ' lançamento(s)' });
    } finally { setLendo(false); }
  }

  return {
    competencia: cr.rotuloCompetencia(s.estado.competencia),
    contaBanco,
    banco: banco ? { id: banco.id, nome: banco.nome, marca: banco.marca, conta: [banco.agencia && 'Ag. ' + banco.agencia, banco.conta && 'C/C ' + banco.conta].filter(Boolean).join(' · ') } : null,
    lendo,
    /** o razão do banco no período já está aqui (sem ele, só o importar) */
    temRazao: !!saldo?.completo,
    bate,
    /** o resumo no meio da linha: o saldo final do extrato e o do razão */
    resumo: saldo?.completo ? ['Extrato ' + x.reaisBR(saldo.extrato), 'Razão ' + x.reaisBR(saldo.razao)] : [],
    dias: (saldo?.dias || []).map(d => ({ data: x.dataBR(d.data), extrato: x.reaisBR(d.extrato), razao: x.reaisBR(d.razao), diferenca: x.reaisBR(d.diferenca) })),
    diferencaFinal: saldo?.completo && !saldo.bate ? x.reaisBR(saldo.razao - saldo.extrato) : '',
    /** as partes do .xls do Creditor que não estão no razão (o total ainda não foi trocado no Alterdata) */
    partesFaltando: faltam.map(p => ({ data: x.dataBR(p.data), valor: x.reaisBR(p.valor), historico: p.historico })),
    importarRazao: (f: File | undefined) => { void importarRazao(f); },
  };
}
