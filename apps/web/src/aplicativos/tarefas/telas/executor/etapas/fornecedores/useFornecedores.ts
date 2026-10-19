// ViewModel da etapa Fornecedores da Tarefa (Vitor, 07/10/2026: "a mesma coisa que o Clientes, mas o fornecedor errado é o
// devedor"). As mesmas três telas: Arquivos (o balancete dinâmico; com devedor, o "Corrigi, irei reimportar" no lugar do Próximo),
// Fornecedores (o selo do sistema: Saldo, Conferido pelo razão ou Ok, o Ok do sistema na conta zerada, a observação e o razão da conta) e Envio.
// As regras são as do Clientes (@nads/core clientes) com o lado 'fornecedores': o saldo vem com o sinal trocado (positivo =
// a empresa deve), então o "credor" das regras é o fornecedor devedor. As marcas ficam por mês, por enquanto só neste navegador.
import { clientes as cl, conferencia as c, demo, extrator as x, formatos, mandei as md, tarefas } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMarcasDoMes } from '../../../../dados/clientes';
import { useCadastro, useContatoDoEntregas } from '../../../../dados/repo';
import { useExtratorDaEmpresa } from '../../../../dados/extrator';
import { criarTicket } from '../../../../dados/mandei';
import { useOperador } from '../../../../casca/operador';
import { useChaveDaEtapa, useDadosDeTesteDaEtapa, useEtapaAberta, useRequisitosDaEtapa } from '../contexto';
import { useGuardado } from '../../../../../../comum/guardado';
import { useContabilDaEmpresa } from '../../../../../../comum/contabilDaEmpresa';

export type TelaFornecedores = 'arquivos' | 'fornecedores' | 'envio';
export type FiltroFornecedores = 'todos' | 'pendente' | 'ok' | 'conferido';

const mesAntes = (m: string) => { const [a, mm] = m.split('-').map(Number); return mm === 1 ? (a - 1) + '-12' : a + '-' + String(mm - 1).padStart(2, '0'); };

const LADO: cl.LadoDaConta = 'fornecedores';

/** As baixas aceitas de um item: os lançamentos, o que falta (o valor da linha), o aceito e se quitou. */
function baixasDoItem(i: cl.ItemDoRazao, baixas: Record<string, cl.BaixaAceita[]> | undefined) {
  const aceitas = (i.status === 'aberto' && !i.interno && baixas?.[cl.chaveDoItem(i)]) || [];
  const falta = aceitas.length ? cl.faltaDaNota(i.valor, aceitas) : null;
  return {
    baixas: aceitas.map(noBanco), quitada: falta === 0,
    ...(falta !== null ? { valor: formatos.reais(falta / 100), aceito: formatos.reais(aceitas.reduce((t, b) => t + Math.abs(b.valor), 0) / 100) } : { aceito: '' }),
  };
}

/** A nota para a sugestão: só o que falta, e as aceitas contam como parcelas pagas (o ritmo e o valor delas). */
function notaQueFalta(i: cl.ItemDoRazao, baixas: Record<string, cl.BaixaAceita[]> | undefined) {
  const aceitas = baixas?.[cl.chaveDoItem(i)] || [];
  if (!aceitas.length) return i;
  return { ...i, valor: cl.faltaDaNota(i.valor, aceitas) / 100, pagos: [...(i.pagos || []), ...aceitas.map(b => ({ data: b.data, valor: Math.abs(b.valor) / 100 }))] };
}

/** O lançamento do banco como a mini tabela da sugestão mostra (o bruto volta no aceitar). */
const noBanco = (g: cl.LancamentoDoBanco) => ({
  bruto: g, data: g.data.slice(8, 10) + '/' + g.data.slice(5, 7) + '/' + g.data.slice(0, 4), banco: g.banco, marca: g.marca || '', historico: g.historico,
  // a descrição curta, até 60 letras (Vitor, 15/10/2026: "limita mais caracteres"); a inteira vai na dica
  curto: g.historico.length > 60 ? g.historico.slice(0, 60).trimEnd() + '…' : g.historico, valor: formatos.reais(Math.abs(g.valor) / 100),
});

/** os lançamentos livres sem os recusados da nota (sem recusa, a mesma lista: nada de copiar milhares por nota; 19/10/2026) */
function semAsRecusadas<L extends cl.LancamentoDoBanco>(livres: L[], recusadas: readonly cl.LancamentoDoBanco[] | undefined): L[] {
  return recusadas?.length ? livres.filter(x => !recusadas.some(r => cl.mesmoLancamento(r, x))) : livres;
}

export function useFornecedores() {
  const s = useEtapaAberta();
  const { aviso } = useRetorno();
  const mes = s.meses[s.meses.length - 1] || '';
  // onde parou (Vitor, 15/10/2026): a tela, até onde chegou e o dinâmico ficam guardados; voltou, está tudo lá
  const chave = useChaveDaEtapa('fornecedores');
  const [tela, setTelaDaVez] = useGuardado<TelaFornecedores>(chave + '|tela', 'arquivos');
  // até onde a pessoa já chegou: as abas depois disso ficam apagadas (Vitor, 07/10/2026: "deixar ofuscado as próximas tarefas")
  const [alcancada, setAlcancada] = useGuardado(chave + '|alcancada', 0);
  const ORDEM: TelaFornecedores[] = ['arquivos', 'fornecedores', 'envio'];
  const setTela = (t: TelaFornecedores) => { setTelaDaVez(t); setAlcancada(a => Math.max(a, ORDEM.indexOf(t))); };
  const [dinamicoProprio, setDinamico] = useGuardado<{ nome: string; d: cl.BalanceteDinamico } | null>(chave + '|dinamico', null);
  // o dinâmico da Importação (o primeiro passo; 16/10/2026) vale aqui também; o importado aqui vai para lá
  const contabil = useContabilDaEmpresa(s.nome, s.codigo);
  const dinamico = dinamicoProprio || contabil.dinamico;
  const [filtro, setFiltro] = useState<FiltroFornecedores>('todos');
  const [busca, setBusca] = useState('');
  // o Mandei (Vitor, 07/10/2026): o ticket com o link para o cliente responder, anexar e a gente acompanhar
  const op = useOperador().operador;
  // o e-mail e o WhatsApp da empresa ficam no Cadastro (Vitor, 07/10/2026): o Mandei manda pelos dois
  const vivo = useCadastro(s.nome, s.codigo);
  // os lançamentos dos extratos importados (todos os bancos), para a sugestão de baixa das notas em aberto (Vitor, 15/10/2026)
  const ext = useExtratorDaEmpresa(s.nome);
  const cadastroVivo = vivo.carregada ? vivo.cadastro : null;
  const lancsDoBanco = useMemo(() => {
    const { bancos, primeiro } = x.bancosDaEmpresaNa(ext, cadastroVivo, s.codigo, s.meses[s.meses.length - 1] || s.competencia);
    const doBanco = new Map(bancos.map(b => [b.id, b]));
    return ext.arquivos.filter(a => a.lado === 'banco').flatMap(a => {
      const b = x.bancoDoArquivo(a, primeiro);
      const banco = doBanco.get(b);
      return a.lancamentos.map(l => ({ data: l.data, valor: l.valor, historico: l.historico, banco: banco?.nome || b, marca: banco?.marca || b }));
    });
  }, [ext, cadastroVivo, s.codigo, s.meses, s.competencia]);
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
  function entrarComDinamico(nome: string, d: cl.BalanceteDinamico, deTeste = false) {
    // o de verdade vai para a Importação (vale para as outras etapas); o de teste fica só aqui
    if (deTeste) setDinamico({ nome, d });
    else { setDinamico(null); contabil.usarDinamico(nome, d); }
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
    entrarComDinamico('balancete-dinamico-de-teste.xls', d, true);
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
    return { codigo: k.codigo, nome: k.nome, saldo: k.saldo, situacao, obs: marca?.obs || '', razao: marca?.razao, perguntar: marca?.perguntar, baixas: marca?.baixas, recusadas: marca?.recusadas, doMesAnterior: !marcas.doc.contas[k.codigo] && !!passam[k.codigo] };
  });

  // os lançamentos do banco já aceitos como baixa de alguma nota não são sugeridos de novo
  const aceitas = linhas.flatMap(l => Object.values(l.baixas || {}).flat());
  const livres = lancsDoBanco.filter(x => !aceitas.some(a => cl.mesmoLancamento(a, x)));

  const atualDe = (l: (typeof linhas)[number]): cl.MarcaDoCliente => ({ nome: l.nome, saldo: l.saldo, situacao: l.situacao, ...(l.obs ? { obs: l.obs } : {}), ...(l.razao ? { razao: l.razao } : {}), ...(l.perguntar ? { perguntar: l.perguntar } : {}), ...(l.baixas ? { baixas: l.baixas } : {}), ...(l.recusadas ? { recusadas: l.recusadas } : {}) });
  function marcar(codigo: string, mudar: (m: cl.MarcaDoCliente) => cl.MarcaDoCliente) {
    const l = linhas.find(x => x.codigo === codigo);
    if (!l || !marcas.carregado) return;
    marcas.salvar({ ...marcas.doc, contas: { ...marcas.doc.contas, [codigo]: mudar(atualDe(l)) } });
  }

  // os razões da Importação (o upload único; 16/10/2026): cada conta sem razão recebe o dela, uma vez, todas de uma vez
  const aplicados = useRef(new Set<string>());
  useEffect(() => {
    if (!marcas.carregado || !mes) return;
    const novas: [string, cl.RazaoDaMarca][] = [];
    for (const l of linhas) {
      const g = contabil.razaoDaConta(l.codigo);
      if (!g || l.razao) continue;
      const k = l.codigo + '|' + g.arquivo;
      if (aplicados.current.has(k)) continue;
      aplicados.current.add(k);
      novas.push([l.codigo, cl.razaoDaMarca(g.arquivo, cl.conferirRazaoDoCliente(g.razao, mes, LADO), LADO)]);
    }
    if (!novas.length) return;
    const contas = { ...marcas.doc.contas };
    for (const [codigo, razao] of novas) {
      const l = linhas.find(x => x.codigo === codigo);
      if (!l) continue;
      const n: cl.MarcaDoCliente = { ...atualDe(l), situacao: cl.razaoComPendencia(razao) ? 'conferido' : 'pendente', razao };
      delete n.perguntar;
      contas[codigo] = n;
    }
    marcas.salvar({ ...marcas.doc, contas });
  });

  /**
   * O razão da conta do fornecedor (como no Clientes, Vitor, 06/10/2026): acha as notas que o pagamento não fechou; com nota em aberto, o
   * fornecedor vai para a relação (Conferido) com os números. O saldo achado tem de bater com o do balancete dinâmico.
   */
  async function importarRazao(codigo: string, f: File | undefined) {
    const l = linhas.find(x => x.codigo === codigo);
    if (!f || !l || !marcas.carregado) return;
    try {
      const r = cl.conferirRazaoDoCliente(tarefas.lerRazaoDoArquivo(await f.arrayBuffer(), f.name), mes, LADO);
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
  // o que vai para o fornecedor é mandado no Fechamento, num envio só com o de Clientes (Vitor, 16/10/2026)
  void faltaMandar;
  const faltam = [...faltamDosArquivos];
  useRequisitosDaEtapa({ pronto: !faltam.length, faltam });
  const rotuloMes = mes ? tarefas.rotuloNumericoCompetencia(mes) : '';
  const q = busca.trim().toLowerCase();
  const reais = formatos.reais;

  return {
    mes: rotuloMes,
    // sem questionamento, o Envio fica travado (Vitor, 15/10/2026): quem estava nele volta para a lista
    tela: telas.includes(tela) ? (tela === 'envio' && !paraEnviar.length ? 'fornecedores' : tela) : 'arquivos',
    telas: telas.map((t, k) => ({ valor: t, rotulo: t === 'arquivos' ? 'Arquivos' : t === 'fornecedores' ? 'Fornecedores' : 'Envio', oculta: t === 'envio', travada: t === 'envio' && !paraEnviar.length ? 'Nada para questionar' : k > alcancada ? 'Chega aqui pelo Próximo' : false as const })),
    irPara: (t: TelaFornecedores) => { if (telas.indexOf(t) <= alcancada && (t !== 'envio' || paraEnviar.length)) setTela(t); },
    // sem questionamento, sem o Próximo para o Envio (Vitor, 15/10/2026)
    temProxima: i < telas.length - 1 && telas[i] !== 'fornecedores',
    /** na lista, tudo certo e nada para questionar: segue pela seta da próxima etapa, lá em cima */
    semQuestionamento: tela === 'fornecedores' && !faltam.length,
    /** a dica no lugar do Próximo: o que vai ser questionado segue para o Fechamento */
    dicaDoFim: paraEnviar.length ? 'O que vai ser questionado vai junto no Fechamento (um envio só): siga pela seta acima' : 'Nada para questionar: siga para a próxima etapa pela seta acima',
    podeSeguir,
    proximo: () => { if (podeSeguir && i < telas.length - 1) setTela(telas[i + 1]); },
    /** nos Arquivos com fornecedor devedor no mês: o "Corrigi, irei reimportar" no lugar do Próximo (deu tudo ok, volta o Próximo) */
    corrigir: (telas.includes(tela) ? tela : 'arquivos') === 'arquivos' && arquivosProntos && credores.length > 0,
    // Arquivos
    dinamico: dinamico ? { nome: dinamico.nome, resumo: contas.length + ' fornecedores · ' + rotuloMes } : null,
    importar: (f: File | undefined) => { void importar(f); },
    tirar: () => { setDinamico(null); if (!dinamicoProprio) contabil.tirarDinamico(); },
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
          // é desta conta? pelo nome do participante nos históricos, não pelo saldo (Vitor, 15/10/2026)
          deOutro: cl.participanteDeOutraConta(l.razao.participantes, l.nome) || '',
          zerado: Math.abs(l.razao.saldo) < 0.005 && !l.razao.notas.length,
          // a mini tabela embaixo do fornecedor: as notas em aberto e o que ficou solto
          itens: l.razao.itens.map(i => ({ chave: i.interno ? '' : cl.chaveDoItem(i), marcado: !i.interno && cl.itensEscolhidos(l.razao, l.perguntar).includes(i), data: i.data ? i.data.slice(8, 10) + '/' + i.data.slice(5, 7) + '/' + i.data.slice(0, 4) : '', nf: i.nf || '—', descricao: i.descricao, valor: reais(i.valor), abate: i.valor < 0, status: i.status, rotulo: cl.ROTULO_DO_STATUS[i.status], digitado: !!i.digitado,
            // a nota em aberto: os lançamentos do banco que podem ser a baixa dela (o mesmo valor, ou o nome no histórico)
            // a baixa aceita (Vitor, 15/10/2026: "um botãozinho para, quando o usuário mudar ou aceitar a sugestão, ficar Ok")
            // com saldo ainda, não fica Ok: só diminui o valor aceito (Vitor, 15/10/2026)
            ...baixasDoItem(i, l.baixas),
            // sem sugestão na nota quitada ou que vai para o fornecedor (Vitor, 15/10/2026: "oculte a sugestão quando o usuário clicar em perguntar")
            // as recusadas ficam no fim, apagadas, para desfazer (Vitor, 15/10/2026)
            recusadas: i.status === 'aberto' && !i.interno && !baixasDoItem(i, l.baixas).quitada && !cl.itensEscolhidos(l.razao, l.perguntar).includes(i) ? (l.recusadas?.[cl.chaveDoItem(i)] || []).map(noBanco) : [],
            sugestoes: i.status === 'aberto' && !i.interno && !baixasDoItem(i, l.baixas).quitada && !cl.itensEscolhidos(l.razao, l.perguntar).includes(i)
              ? cl.sugestoesDeBaixa(notaQueFalta(i, l.baixas), l.nome, semAsRecusadas(livres, l.recusadas?.[cl.chaveDoItem(i)]), -1).map(g => ({ ...noBanco(g), selos: cl.selosDaSugestao(g, 'fornecedor') })) : [] })),
        } : null,
        // o que vai para o fornecedor (o que foi adicionado no "+" de cada linha da relação; nada = não vai)
        perguntar: l.razao ? cl.itensEscolhidos(l.razao, l.perguntar).map(cl.rotuloDoItem).join(' · ') : '',
      })),
    // sem campo vazio (o banco não aceita undefined)
    /** o "+" de uma linha da relação: adiciona ao que vai para o fornecedor, ou tira (Vitor, 07/10/2026) */
    /** aceita a sugestão de baixa de uma nota em aberto (fica Ok; sai do que vai para o fornecedor) ou desfaz (null) */
    aceitarBaixa: (codigo: string, chave: string, l: cl.LancamentoDoBanco, sim: boolean) => marcar(codigo, m => {
      const n = { ...m };
      const baixas = cl.comBaixa(m.baixas, chave, l, sim);
      // quitada, sai do que vai para o fornecedor
      const item = m.razao?.itens.find(i => !i.interno && cl.chaveDoItem(i) === chave);
      const quitada = !!item && !!baixas?.[chave] && cl.faltaDaNota(item.valor, baixas[chave]) === 0;
      const perguntar = quitada && m.perguntar ? m.perguntar.filter(c => c !== chave) : m.perguntar;
      delete n.baixas; delete n.perguntar;
      return { ...n, ...(baixas ? { baixas } : {}), ...(perguntar && (perguntar.length || !quitada) ? { perguntar } : {}) };
    }),
    /** recusa a sugestão: não é a baixa desta nota, sai da lista dela (Vitor, 15/10/2026) */
    recusarSugestao: (codigo: string, chave: string, l: cl.LancamentoDoBanco) => marcar(codigo, m => {
      const n = { ...m };
      const recusadas = cl.comBaixa(m.recusadas, chave, l, true);
      delete n.recusadas;
      return { ...n, ...(recusadas ? { recusadas } : {}) };
    }),
    /** desfaz a recusa: a sugestão volta para a lista da nota (Vitor, 15/10/2026) */
    desfazerRecusa: (codigo: string, chave: string, l: cl.LancamentoDoBanco) => marcar(codigo, m => {
      const n = { ...m };
      const recusadas = cl.comBaixa(m.recusadas, chave, l, false);
      delete n.recusadas;
      return { ...n, ...(recusadas ? { recusadas } : {}) };
    }),
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
    tirarRazao: (codigo: string) => marcar(codigo, m => { const n = { ...m, situacao: 'pendente' as const }; delete n.razao; delete n.perguntar; delete n.baixas; delete n.recusadas; return n; }),
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
        itens: paraEnviar.map(l => ({ id: l.codigo, titulo: l.nome, valor: reais(l.saldo), opcoes: md.OPCOES_PADRAO, linhas: cl.linhasParaOTicket(l.razao, l.saldo, mes, l.perguntar, LADO, l.baixas) })),
      });
      marcas.salvar({ ...marcas.doc, enviado: assinatura });
      aviso({ tom: 'ok', titulo: 'Ticket ' + md.rotuloDoNumero(t.numero) + ' mandado', texto: [email, whatsapp && 'WhatsApp ' + whatsapp].filter(Boolean).join(' e ') + ' · acompanhe em Mandei' });
    },
  };
}
