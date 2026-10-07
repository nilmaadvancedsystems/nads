// ViewModel da etapa Empréstimos e financiamentos (Vitor, 07/10/2026: "monte uma tela para o usuário upar os razões e
// selecionar o banco daquele empréstimo"): um razão por contrato (vários de uma vez), cada um com o banco dele — sugerido
// pela contrapartida das parcelas (a conta contábil do banco no Cadastro) e trocável no menu. O saldo de cada um mês a mês,
// na grade dos meses; empréstimo é passivo (fica credor ou zera): o mês devedor aparece em vermelho. Fica só na tela.
import { empresas, formatos, tarefas as t } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { useCadastro } from '../../../../dados/repo';
import { useEtapaAberta, useRequisitosDaEtapa } from '../contexto';

const dataBr = (iso: string) => iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4);

interface RazaoDoEmprestimo { id: number; arquivo: string; r: t.RazaoDaConta; banco: string | null }

export function useEmprestimos() {
  const s = useEtapaAberta();
  const { aviso } = useRetorno();
  const { cadastro } = useCadastro(s.nome, s.codigo);
  const meses = s.meses;
  const [razoes, setRazoes] = useState<RazaoDoEmprestimo[]>([]);
  const [seq, setSeq] = useState(1);
  // os bancos da empresa no Cadastro (o nome, a agência e a conta para escolher; a conta contábil para sugerir); sem
  // bancos no Cadastro, a lista de antes (a mesma do Extrator), sem a linha genérica "Banco"
  const doCadastro = (cadastro.bancos || []).map(b => ({
    id: b.id, nome: b.apelido || b.nome, contaContabil: b.contaContabil as string | undefined,
    detalhe: [b.agencia && 'Ag. ' + b.agencia, b.conta && 'C/C ' + b.conta].filter(Boolean).join(' · '),
  }));
  const bancos = doCadastro.length ? doCadastro : empresas.bancosDaEmpresa(s.codigo).filter(b => b.id !== 'banco').map(b => ({
    id: b.id, nome: b.nome, contaContabil: undefined as string | undefined,
    detalhe: [b.agencia && 'Ag. ' + b.agencia, b.conta && 'C/C ' + b.conta].filter(Boolean).join(' · '),
  }));

  async function importar(fs: File[]) {
    const novos: RazaoDoEmprestimo[] = [];
    let n = seq;
    for (const f of fs) {
      try {
        const r = t.lerRazaoDoArquivo(await f.arrayBuffer());
        novos.push({ id: n++, arquivo: f.name, r, banco: t.bancoDoRazao(r, bancos) });
      } catch (e) { aviso({ tom: 'erro', titulo: 'Não deu para ler ' + f.name, texto: e instanceof Error ? e.message : String(e) }); }
    }
    setSeq(n);
    if (novos.length) setRazoes(l => [...l, ...novos]);
  }

  const lista = razoes.map(x => {
    const doPeriodo = t.mesesDoRazao(x.r, meses);
    const devedores = t.mesesDevedores(doPeriodo);
    const banco = bancos.find(b => b.id === x.banco) || null;
    return {
      id: x.id, arquivo: x.arquivo,
      resumo: doPeriodo.reduce((n, m) => n + m.lancamentos.length, 0) + ' lançamentos · saldo ' + (doPeriodo.length ? t.valorComLado(doPeriodo[doPeriodo.length - 1].saldoFinal) : '—'),
      banco: banco ? { id: banco.id, rotulo: banco.nome + (banco.detalhe ? ' · ' + banco.detalhe : '') } : null,
      meses: doPeriodo.map(m => ({
        mes: m.mes, rotulo: t.rotuloNumericoCompetencia(m.mes), qtd: m.lancamentos.length,
        saldo: t.valorComLado(m.saldoFinal), devedor: m.saldoFinal < -0.005,
      })),
      devedores: devedores.map(t.rotuloNumericoCompetencia),
      saldoAnterior: doPeriodo.length ? t.valorComLado(doPeriodo[0].saldoInicial) : '',
      lancamentos: doPeriodo.flatMap(m => m.lancamentos).map((l, i) => ({
        id: i, data: dataBr(l.data), contrapartida: l.contrapartida + (l.nomeContrapartida ? ' — ' + l.nomeContrapartida : ''), historico: l.historico,
        // negativo = débito no Alterdata; saldo negativo = devedor
        debito: l.valor < 0 ? formatos.brl(-l.valor) : '', credito: l.valor > 0 ? formatos.brl(l.valor) : '',
        saldo: t.valorComLado(l.saldo), devedor: l.saldo < -0.005,
      })),
    };
  });

  // na Tarefa: pelo menos um razão e o banco de cada um escolhido (a empresa sem empréstimo usa o "Não se aplica")
  const semBanco = lista.filter(x => !x.banco).length;
  const faltam = !lista.length ? ['Importar o razão de cada empréstimo']
    : semBanco ? ['Escolher o banco de ' + (semBanco === 1 ? '1 empréstimo' : semBanco + ' empréstimos')] : [];
  useRequisitosDaEtapa({ pronto: !faltam.length, faltam });

  return {
    periodo: t.rotuloDoPeriodo([...meses]),
    bancos: bancos.map(b => ({ id: b.id, rotulo: b.nome + (b.detalhe ? ' · ' + b.detalhe : '') })),
    importar: (fs: File[]) => { void importar(fs); },
    tirar: (id: number) => setRazoes(l => l.filter(x => x.id !== id)),
    escolherBanco: (id: number, banco: string) => setRazoes(l => l.map(x => (x.id === id ? { ...x, banco } : x))),
    emprestimos: lista,
  };
}

export type VmEmprestimos = ReturnType<typeof useEmprestimos>;
