// ViewModel da etapa Fornecedores da Tarefa (Vitor, 07/10/2026: "a mesma coisa que o Clientes, mas o fornecedor errado é o
// devedor"). As mesmas quatro telas: Arquivos (o balancete dinâmico), Saldo devedor (só quando tem: corrigir e reimportar),
// Fornecedores (o selo Saldo ↔ Conferido, o Ok do sistema na conta zerada, a observação e o razão da conta) e Envio.
// As regras são as do Clientes (@nads/core clientes) com o lado 'fornecedores': o saldo vem com o sinal trocado (positivo =
// a empresa deve), então o "credor" das regras é o fornecedor devedor. As marcas ficam por mês, por enquanto só neste navegador.
import { clientes as cl, conferencia as c, demo, formatos, mandei as md, tarefas } from '@nads/core';
import { baixarBytes, useRetorno } from '@nads/ui';
import { useMemo, useState } from 'react';
import { gravarMensagem, lerMensagem, useMarcasDoMes } from '../../../../dados/clientes';
import { criarTicket } from '../../../../dados/mandei';
import { useOperador } from '../../../../casca/operador';
import { useDadosDeTesteDaEtapa, useEtapaAberta, useRequisitosDaEtapa } from '../contexto';

export type TelaFornecedores = 'arquivos' | 'devedor' | 'fornecedores' | 'envio';
export type FiltroFornecedores = 'todos' | 'pendente' | 'ok' | 'conferido';

const mesAntes = (m: string) => { const [a, mm] = m.split('-').map(Number); return mm === 1 ? (a - 1) + '-12' : a + '-' + String(mm - 1).padStart(2, '0'); };

const LADO: cl.LadoDaConta = 'fornecedores';

export function useFornecedores() {
  const s = useEtapaAberta();
  const { aviso } = useRetorno();
  const mes = s.meses[s.meses.length - 1] || '';
  const [tela, setTela] = useState<TelaFornecedores>('arquivos');
  const [dinamico, setDinamico] = useState<{ nome: string; d: cl.BalanceteDinamico } | null>(null);
  const [filtro, setFiltro] = useState<FiltroFornecedores>('todos');
  const [busca, setBusca] = useState('');
  const [mensagem, setMensagem] = useState(() => lerMensagem(LADO));
  // o Mandei (Vitor, 07/10/2026): o ticket com o link para o cliente responder, anexar e a gente acompanhar
  const op = useOperador().operador;
  const [emailDoCliente, setEmailDoCliente] = useState('');
  const avisar = (m: string) => aviso({ tom: 'erro', titulo: 'Fornecedores', texto: m });
  const marcas = useMarcasDoMes(s.nome, mes, avisar, LADO);
  const anterior = useMarcasDoMes(s.nome, mes ? mesAntes(mes) : '', undefined, LADO);

  async function importar(f: File | undefined) {
    if (!f) return;
    try {
      const rows = c.lerPlanilha(await f.arrayBuffer());
      const d = cl.lerBalanceteDinamico(rows);
      if (!d.meses.includes(mes)) throw new Error('O balancete dinâmico não tem o mês ' + tarefas.rotuloNumericoCompetencia(mes) + '.');
      setDinamico({ nome: f.name, d });
      aviso({ tom: 'ok', titulo: 'Balancete dinâmico importado', texto: f.name });
    } catch (e) { aviso({ tom: 'erro', titulo: 'Não deu para ler ' + f.name, texto: e instanceof Error ? e.message : String(e) }); }
  }

  // o ⚡ do modo desenvolvedor na Tarefa: um balancete dinâmico fictício do mês (com ou sem devedores), como se importado
  const teste = useDadosDeTesteDaEtapa(mes && (s.dev || demo.ehEmpresaDemo(s.nome)) && tela !== 'envio' ? [
    { id: 'dinamico', rotulo: 'Balancete dinâmico (sem devedores)' },
    { id: 'dinamico-credores', rotulo: 'Balancete dinâmico (com saldo devedor)' },
  ] : [], id => {
    const d = cl.dinamicoDeTeste(mes, id === 'dinamico-credores', LADO);
    setDinamico({ nome: 'balancete-dinamico-de-teste.xls', d });
    aviso({ tom: 'ok', titulo: 'Balancete dinâmico de teste', texto: 'Só nesta tela: nada vai para o banco.' });
  });

  const contas = useMemo(() => (dinamico && mes ? cl.clientesDoDinamico(dinamico.d, mes, LADO) : []), [dinamico, mes]);
  // os fornecedores devedores (o "credor" das regras, com o sinal trocado)
  const credores = cl.credores(contas);
  // os credores em algum mês do dinâmico até o da etapa (Vitor, 07/10/2026), com o saldo mês a mês
  const credoresNoPeriodo = useMemo(() => (dinamico && mes ? cl.credoresNoPeriodo(dinamico.d, mes, LADO) : []), [dinamico, mes]);
  const passam = cl.conferidosQuePassam(anterior.doc, marcas.doc);
  const linhas = contas.map(k => {
    const marca = marcas.doc.contas[k.codigo] || passam[k.codigo];
    const situacao = cl.situacaoDe(k, marca);
    return { codigo: k.codigo, nome: k.nome, saldo: k.saldo, situacao, obs: marca?.obs || '', razao: marca?.razao, doMesAnterior: !marcas.doc.contas[k.codigo] && !!passam[k.codigo] };
  });

  function marcar(codigo: string, mudar: (m: cl.MarcaDoCliente) => cl.MarcaDoCliente) {
    const l = linhas.find(x => x.codigo === codigo);
    if (!l || !marcas.carregado) return;
    const atual: cl.MarcaDoCliente = { nome: l.nome, saldo: l.saldo, situacao: l.situacao, ...(l.obs ? { obs: l.obs } : {}), ...(l.razao ? { razao: l.razao } : {}) };
    marcas.salvar({ contas: { ...marcas.doc.contas, [codigo]: mudar(atual) } });
  }

  /**
   * O razão da conta do fornecedor (como no Clientes, Vitor, 06/10/2026): acha as notas que o pagamento não fechou; com nota em aberto, o
   * fornecedor vai para a relação (Conferido) com os números. O saldo achado tem de bater com o do balancete dinâmico.
   */
  async function importarRazao(codigo: string, f: File | undefined) {
    const l = linhas.find(x => x.codigo === codigo);
    if (!f || !l || !marcas.carregado) return;
    try {
      const r = cl.conferirRazaoDoCliente(tarefas.lerRazaoDoArquivo(await f.arrayBuffer()), mes, LADO);
      const razao = cl.razaoDaMarca(f.name, r, LADO);
      // com nota em aberto, a observação já vem escrita (Vitor, 07/10/2026): "No meu sistema, está em aberto…"
      const pronta = cl.observacaoDoRazao(razao);
      marcar(codigo, m => ({ ...m, situacao: razao.notas.length ? 'conferido' : m.situacao, razao, ...(!m.obs && pronta ? { obs: pronta } : {}) }));
      const bate = Math.abs(r.saldo - l.saldo) < 0.005;
      const partes = [
        razao.notas.length ? (razao.notas.length === 1 ? '1 nota em aberto' : razao.notas.length + ' notas em aberto') : 'Nenhuma nota em aberto',
        ...(razao.duplicadas.length ? ['pagamento em duplicidade: NF ' + razao.duplicadas.join(', ')] : []),
      ];
      // zerado no razão: o Ok do sistema (Vitor, 07/10/2026)
      const zerado = Math.abs(r.saldo) < 0.005 && !razao.notas.length;
      aviso(zerado ? { tom: 'ok', titulo: l.nome, texto: 'Zerado no razão: Ok' } : bate
        ? { tom: 'ok', titulo: l.nome, texto: partes.join(' · ') }
        : { tom: 'erro', titulo: 'O razão não bate com o balancete', texto: l.nome + ': o razão fecha ' + rotuloMes + ' em ' + reais(r.saldo) + '; o balancete dinâmico, ' + reais(l.saldo) + '. Confira se é o razão desta conta.' });
    } catch (e) { aviso({ tom: 'erro', titulo: 'Não deu para ler ' + f.name, texto: e instanceof Error ? e.message : String(e) }); }
  }

  const arquivosProntos = !!dinamico;
  const telas: TelaFornecedores[] = ['arquivos', ...(arquivosProntos && credores.length ? ['devedor' as const] : []), 'fornecedores', 'envio'];
  const i = telas.indexOf(tela);
  const podeSeguir = tela === 'arquivos' ? arquivosProntos && contas.length > 0 : tela === 'devedor' ? credores.length === 0 : tela === 'fornecedores';
  // na Tarefa: os arquivos e nenhum credor (a pessoa pode dar o check normal depois; os conferidos passam para o mês seguinte)
  const faltam = !arquivosProntos ? ['Importar o balancete dinâmico'] : credores.length ? ['Corrigir ' + credores.length + (credores.length === 1 ? ' fornecedor' : ' fornecedores') + ' com saldo devedor'] : [];
  useRequisitosDaEtapa({ pronto: !faltam.length, faltam });

  const conferidos = linhas.filter(l => l.situacao === 'conferido');
  const paraCliente: cl.LinhaParaCliente[] = conferidos.map(l => ({ codigo: l.codigo, nome: l.nome, saldo: l.saldo, obs: l.obs, notas: l.razao?.notas }));
  const rotuloMes = mes ? tarefas.rotuloNumericoCompetencia(mes) : '';
  const texto = cl.textoDaMensagem(mensagem, s.nome, rotuloMes, paraCliente);
  const q = busca.trim().toLowerCase();
  const reais = formatos.reais;

  return {
    mes: rotuloMes,
    tela: telas.includes(tela) ? tela : 'arquivos',
    telas: telas.map(t => ({ valor: t, rotulo: t === 'arquivos' ? 'Arquivos' : t === 'devedor' ? 'Saldo devedor' : t === 'fornecedores' ? 'Fornecedores' : 'Envio' })),
    irPara: (t: TelaFornecedores) => setTela(t),
    temProxima: i < telas.length - 1,
    podeSeguir,
    proximo: () => { if (podeSeguir && i < telas.length - 1) setTela(telas[i + 1]); },
    // Arquivos
    dinamico: dinamico ? { nome: dinamico.nome, resumo: contas.length + ' fornecedores · ' + rotuloMes } : null,
    importar: (f: File | undefined) => { void importar(f); },
    tirar: () => setDinamico(null),
    /** o ⚡ do modo desenvolvedor na linha */
    teste,
    // Arquivos: os devedores em algum mês, mês a mês
    mesesDosCredores: (credoresNoPeriodo[0]?.saldos || []).map(x => tarefas.rotuloNumericoCompetencia(x.mes)),
    credoresNoPeriodo: credoresNoPeriodo.map(c => ({
      codigo: c.codigo, nome: c.nome,
      // sem sinal (Vitor, 07/10/2026): o certo (credor) em branco; o errado (devedor) em azul
      saldos: c.saldos.map(x => ({ mes: x.mes, valor: x.saldo ? reais(Math.abs(x.saldo)) : '—', credor: x.saldo < -0.005, cor: x.saldo < -0.005 ? 'ext-azul' : '' })),
    })),
    // Saldo devedor
    credores: credores.map(k => ({ codigo: k.codigo, nome: k.nome, saldo: reais(Math.abs(k.saldo)) })),
    // Fornecedores
    carregado: marcas.carregado,
    /** as perguntas prontas para o cliente (o menu da observação) */
    objecoes: cl.OBJECOES_DO_FORNECEDOR,
    filtro, setFiltro, busca, setBusca,
    contagem: { todos: linhas.length, pendente: linhas.filter(l => l.situacao === 'pendente').length, ok: linhas.filter(l => l.situacao === 'ok').length, conferido: conferidos.length },
    linhas: linhas
      .filter(l => filtro === 'todos' || l.situacao === filtro)
      .filter(l => !q || (l.codigo + ' ' + l.nome).toLowerCase().includes(q))
      .map(l => ({
        ...l, valor: reais(l.saldo),
        // o resumo do razão importado, embaixo do nome
        razao: l.razao ? {
          arquivo: l.razao.arquivo,
          notas: cl.textoDasNotas(l.razao.notas),
          devolucoes: l.razao.devolucoes ? reais(l.razao.devolucoes) : '',
          duplicadas: l.razao.duplicadas.map(nf => 'NF ' + nf).join(', '),
          naoBate: Math.abs(l.razao.saldo - l.saldo) >= 0.005 && Math.abs(l.razao.saldo) >= 0.005 ? reais(l.razao.saldo) : '',
          zerado: Math.abs(l.razao.saldo) < 0.005 && !l.razao.notas.length,
          // a mini tabela embaixo do fornecedor: as notas em aberto e o que ficou solto
          itens: l.razao.itens.map(i => ({ data: i.data ? i.data.slice(8, 10) + '/' + i.data.slice(5, 7) + '/' + i.data.slice(0, 4) : '', nf: i.nf || '—', descricao: i.descricao, valor: reais(i.valor), abate: i.valor < 0, status: i.status, rotulo: cl.ROTULO_DO_STATUS[i.status] })),
        } : null,
      })),
    clicar: (codigo: string) => marcar(codigo, m => ({ ...m, situacao: cl.proximaSituacao(m.situacao) })),
    // sem campo vazio (o banco não aceita undefined)
    observar: (codigo: string, obs: string) => marcar(codigo, m => {
      const n = { ...m };
      delete n.obs;
      return obs.trim() ? { ...n, obs: obs.trim() } : n;
    }),
    /** o razão da conta: importar (acha as notas em aberto) e tirar */
    importarRazao: (codigo: string, f: File | undefined) => { void importarRazao(codigo, f); },
    tirarRazao: (codigo: string) => marcar(codigo, m => { const n = { ...m }; delete n.razao; return n; }),
    // Envio
    conferidos: conferidos.map(l => ({ codigo: l.codigo, nome: l.nome, valor: reais(l.saldo), obs: l.obs, notas: cl.textoDasNotas(l.razao?.notas) })),
    mensagem, texto,
    mudarMensagem: (t: string) => { setMensagem(t); gravarMensagem(t, LADO); },
    // o Mandei: um ticket com os conferidos (cada um, um item com a nossa pergunta), o link vai por e-mail
    emailDoCliente, setEmailDoCliente,
    /** os conferidos sem o razão: no ticket, o cliente vê só o saldo do mês (sem a nota, a data e o banco) */
    semRazao: conferidos.filter(l => !l.razao?.itens.some(i => !i.interno)).map(l => l.nome),
    mandarPeloMandei: () => {
      const email = emailDoCliente.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { aviso({ tom: 'erro', titulo: 'Mandei', texto: 'Informe o e-mail do cliente.' }); return; }
      const t = criarTicket({
        empresa: { nome: s.nome, codigo: s.codigo }, para: { nome: '', email },
        assunto: 'Fornecedores em aberto — ' + rotuloMes,
        mensagem: 'Na conferência dos fornecedores de ' + rotuloMes + ', estes saldos ficaram em aberto. Pode nos dizer o que aconteceu com cada um?',
        criadoPor: { nome: op?.nome || '' },
        origem: { titulo: 'Fornecedores · ' + rotuloMes, rota: window.location.pathname, competencia: mes },
        // os lançamentos de cada um (a nota em aberto com a data e o número; o pagamento solto com a data e o banco)
        itens: conferidos.map(l => ({ id: l.codigo, titulo: l.nome, valor: reais(l.saldo), ...(l.obs ? { detalhe: l.obs } : {}), opcoes: md.OPCOES_PADRAO, linhas: cl.linhasParaOTicket(l.razao, l.saldo, mes) })),
      });
      aviso({ tom: 'ok', titulo: 'Ticket ' + md.rotuloDoNumero(t.numero) + ' mandado', texto: email + ' · acompanhe em Mandei' });
    },
    baixarPlanilha: () => baixarBytes(cl.planilhaParaCliente(paraCliente, LADO), 'fornecedores_' + (s.codigo ?? s.nome) + '_' + mes + '.xlsx', cl.TIPO_XLSX),
    email: 'mailto:?subject=' + encodeURIComponent('Fornecedores em aberto — ' + rotuloMes) + '&body=' + encodeURIComponent(texto),
    whatsapp: 'https://wa.me/?text=' + encodeURIComponent(texto),
  };
}
