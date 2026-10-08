// ViewModel da etapa Fornecedores da Tarefa (Vitor, 07/10/2026: "a mesma coisa que o Clientes, mas o fornecedor errado é o
// devedor"). As mesmas três telas: Arquivos (o balancete dinâmico; com devedor, o "Corrigi, irei reimportar" no lugar do Próximo),
// Fornecedores (o selo do sistema: Saldo, Conferido pelo razão ou Ok, o Ok do sistema na conta zerada, a observação e o razão da conta) e Envio.
// As regras são as do Clientes (@nads/core clientes) com o lado 'fornecedores': o saldo vem com o sinal trocado (positivo =
// a empresa deve), então o "credor" das regras é o fornecedor devedor. As marcas ficam por mês, por enquanto só neste navegador.
import { clientes as cl, conferencia as c, demo, formatos, mandei as md, tarefas } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useMemo, useState } from 'react';
import { useMarcasDoMes } from '../../../../dados/clientes';
import { useCadastro, useContatoDoEntregas } from '../../../../dados/repo';
import { criarTicket } from '../../../../dados/mandei';
import { useOperador } from '../../../../casca/operador';
import { useDadosDeTesteDaEtapa, useEtapaAberta, useRequisitosDaEtapa } from '../contexto';

export type TelaFornecedores = 'arquivos' | 'fornecedores' | 'envio';
export type FiltroFornecedores = 'todos' | 'pendente' | 'ok' | 'conferido';

const mesAntes = (m: string) => { const [a, mm] = m.split('-').map(Number); return mm === 1 ? (a - 1) + '-12' : a + '-' + String(mm - 1).padStart(2, '0'); };

const LADO: cl.LadoDaConta = 'fornecedores';

export function useFornecedores() {
  const s = useEtapaAberta();
  const { aviso } = useRetorno();
  const mes = s.meses[s.meses.length - 1] || '';
  const [tela, setTelaDaVez] = useState<TelaFornecedores>('arquivos');
  // até onde a pessoa já chegou: as abas depois disso ficam apagadas (Vitor, 07/10/2026: "deixar ofuscado as próximas tarefas")
  const [alcancada, setAlcancada] = useState(0);
  const ORDEM: TelaFornecedores[] = ['arquivos', 'fornecedores', 'envio'];
  const setTela = (t: TelaFornecedores) => { setTelaDaVez(t); setAlcancada(a => Math.max(a, ORDEM.indexOf(t))); };
  const [dinamico, setDinamico] = useState<{ nome: string; d: cl.BalanceteDinamico } | null>(null);
  const [filtro, setFiltro] = useState<FiltroFornecedores>('todos');
  const [busca, setBusca] = useState('');
  // o Mandei (Vitor, 07/10/2026): o ticket com o link para o cliente responder, anexar e a gente acompanhar
  const op = useOperador().operador;
  // o e-mail e o WhatsApp da empresa ficam no Cadastro (Vitor, 07/10/2026): o Mandei manda pelos dois
  const vivo = useCadastro(s.nome, s.codigo);
  // sem o contato no Cadastro do nads, o que o Entregas já tem do cliente (Vitor, 08/10/2026: "já tenho no mínimo 1 canal")
  const doEntregas = useContatoDoEntregas(s.codigo);
  const contato = { email: vivo.cadastro.contato?.email || doEntregas?.email || '', whatsapp: vivo.cadastro.contato?.whatsapp || doEntregas?.whatsapp || '' };
  const avisar = (m: string) => aviso({ tom: 'erro', titulo: 'Fornecedores', texto: m });
  const marcas = useMarcasDoMes(s.nome, mes, avisar, LADO);
  const anterior = useMarcasDoMes(s.nome, mes ? mesAntes(mes) : '', undefined, LADO);

  /**
   * Põe o dinâmico na tela. Tudo certo (com contas e nenhum devedor no mês), já segue para a lista, sem o Próximo (Vitor,
   * 07/10/2026: "quando importar o dinâmico e estiver tudo certo, já pode prosseguir"); com devedor, fica nos Arquivos.
   */
  function entrarComDinamico(nome: string, d: cl.BalanceteDinamico) {
    setDinamico({ nome, d });
    const doMes = cl.clientesDoDinamico(d, mes, LADO);
    if (doMes.length && !cl.credores(doMes).length) setTela('fornecedores');
  }

  async function importar(f: File | undefined) {
    if (!f) return;
    try {
      const rows = c.lerPlanilha(await f.arrayBuffer());
      const d = cl.lerBalanceteDinamico(rows);
      if (!d.meses.includes(mes)) throw new Error('O balancete dinâmico não tem o mês ' + tarefas.rotuloNumericoCompetencia(mes) + '.');
      entrarComDinamico(f.name, d);
      aviso({ tom: 'ok', titulo: 'Balancete dinâmico importado', texto: f.name });
    } catch (e) { aviso({ tom: 'erro', titulo: 'Não deu para ler ' + f.name, texto: e instanceof Error ? e.message : String(e) }); }
  }

  // o ⚡ do modo desenvolvedor na Tarefa: um balancete dinâmico fictício do mês (com ou sem devedores), como se importado
  const teste = useDadosDeTesteDaEtapa(mes && (s.dev || demo.ehEmpresaDemo(s.nome)) && tela !== 'envio' ? [
    { id: 'dinamico', rotulo: 'Balancete dinâmico (sem devedores)' },
    { id: 'dinamico-credores', rotulo: 'Balancete dinâmico (com saldo devedor)' },
  ] : [], id => {
    const d = cl.dinamicoDeTeste(mes, id === 'dinamico-credores', LADO);
    entrarComDinamico('balancete-dinamico-de-teste.xls', d);
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
    return { codigo: k.codigo, nome: k.nome, saldo: k.saldo, situacao, obs: marca?.obs || '', razao: marca?.razao, perguntar: marca?.perguntar, doMesAnterior: !marcas.doc.contas[k.codigo] && !!passam[k.codigo] };
  });

  function marcar(codigo: string, mudar: (m: cl.MarcaDoCliente) => cl.MarcaDoCliente) {
    const l = linhas.find(x => x.codigo === codigo);
    if (!l || !marcas.carregado) return;
    const atual: cl.MarcaDoCliente = { nome: l.nome, saldo: l.saldo, situacao: l.situacao, ...(l.obs ? { obs: l.obs } : {}), ...(l.razao ? { razao: l.razao } : {}), ...(l.perguntar ? { perguntar: l.perguntar } : {}) };
    marcas.salvar({ ...marcas.doc, contas: { ...marcas.doc.contas, [codigo]: mudar(atual) } });
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
      marcar(codigo, m => { const n = { ...m, situacao: cl.razaoComPendencia(razao) ? 'conferido' as const : 'pendente' as const, razao }; delete n.perguntar; return n; });
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
  // sem a etapa Saldo devedor (Vitor, 07/10/2026: "remove esse saldo devedor e deixe só arquivos"): o devedor fica na grade dos
  // Arquivos e, no lugar do Próximo travado, o "Corrigi, irei reimportar" (tira o dinâmico para importar o corrigido)
  const telas: TelaFornecedores[] = ['arquivos', 'fornecedores', 'envio'];
  // algum razão importado (ou lançamento digitado): sem nenhum, o Envio some e o Próximo da lista também (Vitor, 08/10/2026)
  const algumRazao = linhas.some(l => !!l.razao);
  const i = telas.indexOf(tela);
  const podeSeguir = tela === 'arquivos' ? arquivosProntos && contas.length > 0 && !credores.length : tela === 'fornecedores';
  // na Tarefa: os arquivos e nenhum credor (a pessoa pode dar o check normal depois; os conferidos passam para o mês seguinte)

  const conferidos = linhas.filter(l => l.situacao === 'conferido');
  // o que vai para o fornecedor: os conferidos com alguma linha adicionada no +
  const paraEnviar = conferidos.filter(l => cl.itensEscolhidos(l.razao, l.perguntar).length > 0);
  const faltamDosArquivos = !arquivosProntos ? ['Importar o balancete dinâmico'] : credores.length ? ['Corrigir ' + credores.length + (credores.length === 1 ? ' fornecedor' : ' fornecedores') + ' com saldo devedor'] : [];
  // o que vai ser questionado e ainda não foi mandado trava o avançar da Tarefa (Vitor, 08/10/2026: "a partir do momento
  // que a pessoa upa e quer questionar, bloqueie o avançar"); mudou depois de mandar, trava de novo
  const assinatura = cl.assinaturaDoEnvio(paraEnviar.map(l => ({ codigo: l.codigo, perguntar: cl.itensEscolhidos(l.razao, l.perguntar).map(cl.chaveDoItem) })));
  const faltaMandar = !!assinatura && marcas.doc.enviado !== assinatura;
  const faltam = [...faltamDosArquivos, ...(faltaMandar ? ['Mandar pelo Mandei o que vai ser questionado (' + paraEnviar.length + (paraEnviar.length === 1 ? ' fornecedor)' : ' fornecedores)')] : [])];
  useRequisitosDaEtapa({ pronto: !faltam.length, faltam });
  const rotuloMes = mes ? tarefas.rotuloNumericoCompetencia(mes) : '';
  const q = busca.trim().toLowerCase();
  const reais = formatos.reais;

  return {
    mes: rotuloMes,
    tela: telas.includes(tela) ? tela : 'arquivos',
    telas: telas.map((t, k) => ({ valor: t, rotulo: t === 'arquivos' ? 'Arquivos' : t === 'fornecedores' ? 'Fornecedores' : 'Envio', oculta: t === 'envio' && !algumRazao, travada: k > alcancada ? 'Chega aqui pelo Próximo' : false as const })),
    irPara: (t: TelaFornecedores) => { if (telas.indexOf(t) <= alcancada) setTela(t); },
    temProxima: i < telas.length - 1 && (telas[i] !== 'fornecedores' || algumRazao),
    podeSeguir,
    proximo: () => { if (podeSeguir && i < telas.length - 1) setTela(telas[i + 1]); },
    /** nos Arquivos com fornecedor devedor no mês: o "Corrigi, irei reimportar" no lugar do Próximo (deu tudo ok, volta o Próximo) */
    corrigir: (telas.includes(tela) ? tela : 'arquivos') === 'arquivos' && arquivosProntos && credores.length > 0,
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
    // Fornecedores
    carregado: marcas.carregado,
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
          itens: l.razao.itens.map(i => ({ chave: i.interno ? '' : cl.chaveDoItem(i), marcado: !i.interno && cl.itensEscolhidos(l.razao, l.perguntar).includes(i), data: i.data ? i.data.slice(8, 10) + '/' + i.data.slice(5, 7) + '/' + i.data.slice(0, 4) : '', nf: i.nf || '—', descricao: i.descricao, valor: reais(i.valor), abate: i.valor < 0, status: i.status, rotulo: cl.ROTULO_DO_STATUS[i.status], digitado: !!i.digitado })),
        } : null,
        // o que vai para o fornecedor (o que foi adicionado no "+" de cada linha da relação; nada = não vai)
        perguntar: l.razao ? cl.itensEscolhidos(l.razao, l.perguntar).map(cl.rotuloDoItem).join(' · ') : '',
      })),
    // sem campo vazio (o banco não aceita undefined)
    /** o "+" de uma linha da relação: adiciona ao que vai para o fornecedor, ou tira (Vitor, 07/10/2026) */
    definirEnvio: (codigo: string, chave: string, sim: boolean) => marcar(codigo, m => {
      const n = { ...m };
      const novo = cl.definirItem(m.razao, m.perguntar, chave, sim);
      delete n.perguntar;
      return novo ? { ...n, perguntar: novo } : n;
    }),
    /** o razão da conta: importar (acha as notas em aberto) e tirar */
    importarRazao: (codigo: string, f: File | undefined) => { void importarRazao(codigo, f); },
    // tirou o razão: sai o conferido e o que ia ser questionado; volta ao saldo e não trava o avançar (Vitor, 08/10/2026)
    /** o lançamento digitado à mão (sem upar o razão, ou junto dele): entra na relação e já vai para o questionar */
    digitarLancamento: (codigo: string, l: cl.LancamentoDigitado) => marcar(codigo, m => {
      const razao = cl.comLancamentoDigitado(m.razao, l, m.saldo);
      const novo = razao.itens.find(i => !m.razao?.itens.includes(i));
      const perguntar = novo ? cl.definirItem(razao, m.perguntar, cl.chaveDoItem(novo), true) : m.perguntar;
      const n = { ...m, razao, situacao: cl.razaoComPendencia(razao) ? 'conferido' as const : 'pendente' as const };
      delete n.perguntar;
      return perguntar ? { ...n, perguntar } : n;
    }),
    /** tira um lançamento digitado (o último da relação só de digitados tira a relação: volta ao saldo) */
    tirarDigitado: (codigo: string, chave: string) => marcar(codigo, m => {
      const razao = cl.semLancamentoDigitado(m.razao, chave);
      const perguntar = (m.perguntar || []).filter(c => c !== chave);
      const n = { ...m, situacao: razao && cl.razaoComPendencia(razao) ? 'conferido' as const : 'pendente' as const };
      delete n.razao; delete n.perguntar;
      return { ...n, ...(razao ? { razao } : {}), ...(perguntar.length ? { perguntar } : {}) };
    }),
    tirarRazao: (codigo: string) => marcar(codigo, m => { const n = { ...m, situacao: 'pendente' as const }; delete n.razao; delete n.perguntar; return n; }),
    // Envio
    conferidos: paraEnviar.map(l => ({ codigo: l.codigo, nome: l.nome, valor: reais(l.saldo), perguntar: cl.itensEscolhidos(l.razao, l.perguntar).map(cl.rotuloDoItem).join(' · '), notas: cl.textoDasNotas(l.razao?.notas) })),
    // o Mandei: um ticket com os conferidos (cada um, um item com a nossa pergunta), o link vai por e-mail
    /** o e-mail e o WhatsApp da empresa, do Cadastro */
    contato,
    /** o que falta no Cadastro para mandar (vazio = pode): um dos dois basta (Vitor, 07/10/2026) */
    faltaNoCadastro: !vivo.carregada ? ['o cadastro (carregando)'] : contato.email || contato.whatsapp ? [] : ['o e-mail ou o WhatsApp'],
    /** o que vai ser questionado já foi mandado (e não mudou depois) */
    jaMandado: !!assinatura && !faltaMandar,
    mandarPeloMandei: () => {
      const email = contato.email;
      const whatsapp = contato.whatsapp;
      // um dos dois basta (Vitor, 07/10/2026: "não precisa ser obrigatório ter e-mail e WhatsApp")
      if (!email && !whatsapp) { aviso({ tom: 'erro', titulo: 'Mandei', texto: 'Cadastre o e-mail ou o WhatsApp da empresa em Cadastro › Empresa.' }); return; }
      const t = criarTicket({
        empresa: { nome: s.nome, codigo: s.codigo }, para: { nome: '', email, ...(whatsapp ? { whatsapp } : {}) },
        assunto: 'Fornecedores em aberto — ' + rotuloMes,
        mensagem: 'Na conferência dos fornecedores de ' + rotuloMes + ', estes saldos ficaram em aberto. Pode nos dizer o que aconteceu com cada um?',
        criadoPor: { nome: op?.nome || '' },
        origem: { titulo: 'Fornecedores · ' + rotuloMes, rota: window.location.pathname, competencia: mes },
        // os lançamentos de cada um (a nota em aberto com a data e o número; o pagamento solto com a data e o banco)
        itens: paraEnviar.map(l => ({ id: l.codigo, titulo: l.nome, valor: reais(l.saldo), opcoes: md.OPCOES_PADRAO, linhas: cl.linhasParaOTicket(l.razao, l.saldo, mes, l.perguntar, LADO) })),
      });
      marcas.salvar({ ...marcas.doc, enviado: assinatura });
      aviso({ tom: 'ok', titulo: 'Ticket ' + md.rotuloDoNumero(t.numero) + ' mandado', texto: [email, whatsapp && 'WhatsApp ' + whatsapp].filter(Boolean).join(' e ') + ' · acompanhe em Mandei' });
    },
  };
}
