// ViewModel da etapa Empréstimos e financiamentos (Vitor, 07/10/2026: "monte uma tela para o usuário upar os razões e
// selecionar o banco daquele empréstimo"): um razão por contrato (vários de uma vez), cada um com o banco dele — sugerido
// pela contrapartida das parcelas (a conta contábil do banco no Cadastro) e trocável no menu. O saldo de cada um mês a mês,
// na grade dos meses; empréstimo é passivo (fica credor ou zera): o mês devedor aparece em vermelho. O razão fica só na
// tela; o banco de cada contrato vai para o Cadastro (Vitor, 07/10/2026): nas outras competências a etapa já sabe quais
// empréstimos valem até o mês consultado e de qual banco, e o razão importado lá já vem com o banco.
import { empresas, formatos, tarefas as t } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { useCadastro } from '../../../../dados/repo';
import { useOperador } from '../../../../casca/operador';
import { useEtapaAberta, useRequisitosDaEtapa } from '../contexto';

const dataBr = (iso: string) => iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4);

/** As linhas da tabela, com o saldo acumulado só delas (o saldo de um contrato, não o da conta). */
function comSaldo(ls: readonly t.LancamentoDoRazao[]) {
  let saldo = 0;
  return ls.map((l, i) => {
    saldo = Math.round((saldo + l.valor) * 100) / 100;
    return {
      id: i, data: dataBr(l.data), contrapartida: l.contrapartida + (l.nomeContrapartida ? ' — ' + l.nomeContrapartida : ''), historico: l.historico,
      debito: l.valor < 0 ? formatos.brl(-l.valor) : '', credito: l.valor > 0 ? formatos.brl(l.valor) : '',
      saldo: t.valorComLado(saldo), devedor: saldo < -0.005,
    };
  });
}

interface RazaoDoEmprestimo { id: number; arquivo: string; r: t.RazaoDaConta; banco: string | null }

export function useEmprestimos() {
  const s = useEtapaAberta();
  const { aviso } = useRetorno();
  const { cadastro, carregada, salvar } = useCadastro(s.nome, s.codigo);
  const op = useOperador().operador;
  // os empréstimos já guardados no Cadastro (número, banco, de quando até quando)
  const cadastrados = cadastro.emprestimos || [];
  const meses = s.meses;
  const [razoes, setRazoes] = useState<RazaoDoEmprestimo[]>([]);
  const [seq, setSeq] = useState(1);
  // os bancos da empresa no Cadastro (o nome, a agência e a conta para escolher; a conta contábil para sugerir); sem
  // bancos no Cadastro, a lista de antes (a mesma do Extrator), sem a linha genérica "Banco"
  const doCadastro = (cadastro.bancos || []).map(b => ({
    id: b.id, nome: b.apelido || b.nome, marca: b.marca as string | undefined, contaContabil: b.contaContabil as string | undefined,
    detalhe: [b.agencia && 'Ag. ' + b.agencia, b.conta && 'C/C ' + b.conta].filter(Boolean).join(' · '),
  }));
  const bancos = doCadastro.length ? doCadastro : empresas.bancosDaEmpresa(s.codigo).filter(b => b.id !== 'banco').map(b => ({
    id: b.id, nome: b.nome, marca: b.marca as string | undefined, contaContabil: undefined as string | undefined,
    detalhe: [b.agencia && 'Ag. ' + b.agencia, b.conta && 'C/C ' + b.conta].filter(Boolean).join(' · '),
  }));

  async function importar(fs: File[]) {
    const novos: RazaoDoEmprestimo[] = [];
    let n = seq;
    for (const f of fs) {
      try {
        const r = t.lerRazaoDoArquivo(await f.arrayBuffer());
        // o mesmo razão de novo (o mesmo arquivo, os mesmos lançamentos e o mesmo saldo): não entra duas vezes
        if ([...razoes, ...novos].some(x => x.arquivo === f.name && x.r.lancamentos.length === r.lancamentos.length && x.r.saldoFinal === r.saldoFinal)) {
          aviso({ tom: 'info', titulo: 'Esse razão já está importado', texto: f.name });
          continue;
        }
        // o banco: o dos contratos já guardados no Cadastro; senão, o da contrapartida das parcelas
        const banco = t.bancoPelosContratos(t.contratosDoRazao(r).contratos, cadastrados) ?? t.bancoDoRazao(r, bancos);
        novos.push({ id: n++, arquivo: f.name, r, banco });
        if (banco) guardar(r, banco);
      } catch (e) { aviso({ tom: 'erro', titulo: 'Não deu para ler ' + f.name, texto: e instanceof Error ? e.message : String(e) }); }
    }
    setSeq(n);
    if (novos.length) setRazoes(l => [...l, ...novos]);
  }

  /** os contratos do razão vão para o Cadastro com o banco (o que mudou; igual, não grava) */
  function guardar(r: t.RazaoDaConta, banco: string) {
    if (!carregada) return;
    const novo = empresas.cadastro.registrarEmprestimos(cadastro, t.emprestimosParaOCadastro(t.contratosDoRazao(r).contratos, banco), op?.nome || 'Tarefas', new Date());
    if (novo !== cadastro) salvar(novo);
  }

  const lista = razoes.map(x => {
    const doPeriodo = t.mesesDoRazao(x.r, meses);
    const devedores = t.mesesDevedores(doPeriodo);
    const banco = bancos.find(b => b.id === x.banco) || null;
    // os contratos dentro do razão, até o fim do período (o número vem do histórico)
    const c = t.contratosDoRazao(x.r, meses[meses.length - 1]);
    // o banco já gravado no Cadastro para os contratos deste razão é permanente (Vitor, 07/10/2026: "uma vez colocada, só o
    // adm pode tirar"): para quem não é administrador, o Trocar trava
    const gravado = !!x.banco && t.bancoPelosContratos(t.contratosDoRazao(x.r).contratos, cadastrados) === x.banco;
    const emAberto = c.contratos.filter(k => Math.abs(k.saldo) >= 0.01 && !k.completadoSemNumero);
    return {
      id: x.id, arquivo: x.arquivo,
      resumo: c.contratos.length + (c.contratos.length === 1 ? ' contrato' : ' contratos') + ' (' + emAberto.length + ' em aberto) · saldo ' + (doPeriodo.length ? t.valorComLado(doPeriodo[doPeriodo.length - 1].saldoFinal) : '—'),
      /** os contratos: o número, a liberação, as parcelas pagas e o saldo de cada um; os em aberto primeiro */
      contratos: [...c.contratos].sort((a, b) => Number(emAberto.includes(b)) - Number(emAberto.includes(a)) || b.inicio.localeCompare(a.inicio)).map(k => ({
        numero: k.numero,
        liberado: k.liberadoEm ? formatos.brl(k.liberado) + ' em ' + dataBr(k.liberadoEm) : '—',
        parcelas: k.parcelas ? k.pagas + ' de ' + k.parcelas : k.pagas + (k.pagas === 1 ? ' paga' : ' pagas'),
        saldo: t.valorComLado(k.saldo),
        situacao: k.quitadoComSaldo ? 'quitado-com-saldo' as const : Math.abs(k.saldo) < 0.01 || k.completadoSemNumero ? 'quitado' as const : 'aberto' as const,
        /** quitado junto com os lançamentos sem número (que são dele) */
        comSemNumero: k.completadoSemNumero,
        periodo: dataBr(k.inicio) + ' a ' + dataBr(k.fim),
      })),
      /** os lançamentos sem número de contrato (implantação de saldo, histórico incompleto) */
      semNumero: c.semNumero.length ? { qtd: c.semNumero.length, soma: t.valorComLado(c.somaSemNumero), de: c.contratos.find(k => k.completadoSemNumero)?.numero || '' } : null,
      quitadosComSaldo: c.contratos.filter(k => k.quitadoComSaldo).map(k => k.numero + ' (' + t.valorComLado(k.saldo) + ')'),
      /**
       * Os lançamentos de cada contrato até o mês consultado (Vitor, 07/10/2026: "filtre de acordo com cada contrato"), com o
       * saldo do próprio contrato; e os sem número. A faixa Lançamentos escolhe um deles (ou os do período).
       */
      porContrato: [
        ...c.contratos.map(k => ({ id: k.numero, rotulo: k.numero, lancamentos: comSaldo(k.lancamentos) })),
        ...(c.semNumero.length ? [{ id: 'sem-numero', rotulo: 'Sem número', lancamentos: comSaldo(c.semNumero) }] : []),
      ],
      // a marca do banco: o logo dele na linha (Vitor, 07/10/2026)
      banco: banco ? { id: banco.id, rotulo: banco.nome + (banco.detalhe ? ' · ' + banco.detalhe : ''), marca: banco.marca || banco.id } : null,
      /** o banco está gravado no Cadastro e quem está trabalhando não é administrador: não dá para trocar */
      travado: gravado && !op?.admin,
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
    escolherBanco: (id: number, banco: string) => {
      const x = razoes.find(z => z.id === id);
      // gravado no Cadastro: só o administrador troca
      if (x?.banco && !op?.admin && t.bancoPelosContratos(t.contratosDoRazao(x.r).contratos, cadastrados) === x.banco) return;
      if (x) guardar(x.r, banco);
      setRazoes(l => l.map(z => (z.id === id ? { ...z, banco } : z)));
    },
    /** os empréstimos do Cadastro que valem no período (antes de importar: o que esperar), com o banco e se já veio no razão */
    noPeriodo: t.emprestimosNoPeriodo(cadastrados, meses).map(e => {
      const b = bancos.find(x => x.id === e.banco);
      const noRazao = razoes.some(x => t.contratosDoRazao(x.r).contratos.some(k => k.numero === e.numero));
      return { numero: e.numero, banco: b ? b.nome : e.banco, marca: b?.marca || e.banco, desde: t.rotuloNumericoCompetencia(e.desde), ate: e.ate ? t.rotuloNumericoCompetencia(e.ate) : '', noRazao };
    }),
    emprestimos: lista,
  };
}

export type VmEmprestimos = ReturnType<typeof useEmprestimos>;
