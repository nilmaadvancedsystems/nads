// ViewModel da janela da linha, o "Lançamentos (Cadastramento)" do Alterdata (17/11/2026: "essa tela de lançamento pode ser a
// mesma do lcdpr, só que no estilo do alterdata normal"; 18/11: "expande essa tela, vai ter que melhorar ela"): a data e o
// valor do extrato; o lançamento automático (as regras do banco: escolher uma preenche a conta, o histórico padrão e o
// histórico); a conta devedora e a credora (uma é o banco, fixa; a outra é a contrapartida, com a lupa do plano); o histórico
// padrão, o histórico e o documento. Ao lado, como vai para o Alterdata e a regra para os próximos meses (18/11: "quando eu
// clicar em uma opção de gravar uma regra quando não bater, para que não ocorra mais"). Nada vai para o banco antes do Gravar
// (Ctrl+Enter); a sugerida pelo razão, gravada como está, fica confirmada. A lupa (F2) troca o corpo pelo plano em árvore.
import { lancatudo as lt } from '@nads/core';
import { useState } from 'react';
import type { useRegistroDoLancatudo } from './useRegistroDoLancatudo';

type Vm = ReturnType<typeof useRegistroDoLancatudo>;

export function useJanelaDaLinha(vm: Vm, l: lt.LinhaDoRegistro) {
  const [r, setR] = useState<lt.RascunhoDaLinha>({ conta: l.conta || '', historico: l.historico, codHistorico: l.codHistorico || '', documento: l.documento || '' });
  const [regra, setRegra] = useState<string>(l.regra || '');
  const [pesquisando, setPesquisando] = useState(false);
  const entrada = l.valor > 0;
  const fora = l.situacao === 'ignorada' || l.situacao === 'no-razao';
  const soNumeros = (campo: keyof lt.RascunhoDaLinha) => campo === 'conta' || campo === 'codHistorico';
  const mudar = (campo: keyof lt.RascunhoDaLinha, v: string) => setR(x => ({ ...x, [campo]: soNumeros(campo) ? v.replace(/\D/g, '') : v }));

  const conta = r.conta.trim();
  const nomeDaConta = conta ? vm.nomeDaConta(conta) : '';
  // entrou no banco: D banco / C contrapartida; saiu: D contrapartida / C banco
  const devedora = entrada ? { codigo: l.contaDoBanco, nome: vm.nomeDoBanco, editavel: false } : { codigo: conta, nome: nomeDaConta, editavel: true };
  const credora = entrada ? { codigo: conta, nome: nomeDaConta, editavel: true } : { codigo: l.contaDoBanco, nome: vm.nomeDoBanco, editavel: false };
  const semPlano = !vm.linhasDoPlano.length;

  // o lançamento automático: as regras deste banco que valem neste sentido (a que pegou a linha vem marcada)
  const regras = vm.regras.filter(x => x.sentido === 'ambos' || (x.sentido === 'entrada') === entrada)
    .map(x => ({ id: x.id, rotulo: (x.descricao || x.expressao) + ' → ' + x.conta + (vm.nomeDaConta(x.conta) ? ' ' + vm.nomeDaConta(x.conta) : '') }));
  const semRegras = vm.regras.length ? 'nenhuma regra de ' + (entrada ? 'entrada' : 'saída') + ' neste banco' : 'este banco ainda não tem regra';
  function aplicarRegra(id: string) {
    setRegra(id);
    const x = vm.regras.find(y => y.id === id);
    if (!x) return;
    setR(atual => ({ ...atual, conta: x.conta, codHistorico: x.codHistorico || '', historico: lt.historicoPelaRegra(x, l.historicoDoBanco) }));
  }

  // a regra para os próximos meses: oferecida quando a conta não veio de uma regra; sempre desmarcada (18/11/2026: "tem alguns
  // que quero só gravar na mão, quero que eu tenha que clicar para ativar isso")
  const sugestao = lt.regraSugerida({ historico: l.historicoDoBanco, valor: l.valor });
  const podeCriarRegra = !fora && l.origem !== 'regra';
  const [criarRegra, setCriarRegra] = useState(false);
  const [expressao, setExpressao] = useState(sugestao.expressao);
  const casam = expressao.trim() ? vm.linhas.filter(x => lt.expressaoCasa({ tipo: sugestao.tipo, expressao }, x.historicoDoBanco) && (x.valor > 0) === entrada).length : 0;

  const faltam: string[] = [];
  if (!conta) faltam.push(entrada ? 'a conta credora' : 'a conta devedora');
  if (!l.contaDoBanco) faltam.push('o código contábil do banco (no Cadastro)');
  if (!r.historico.trim()) faltam.push('o histórico');
  const linhaDoPlano = vm.linhasDoPlano.find(x => x.codigo === conta);
  const problema = conta && !semPlano && !linhaDoPlano ? 'A conta ' + conta + ' não está no plano de contas'
    : linhaDoPlano?.sintetica ? 'A conta ' + conta + ' é de título (sintética)' : '';
  const confirmaSugerida = l.situacao === 'sugerida' && conta === (l.conta || '');
  const mudou = conta !== (l.conta || '') || r.historico.trim() !== l.historico || r.codHistorico.trim() !== (l.codHistorico || '') || r.documento.trim() !== (l.documento || '');
  const vaiCriarRegra = podeCriarRegra && criarRegra && !!conta && !!expressao.trim();

  function gravar() {
    if (problema || fora) return;
    if (!mudou && !confirmaSugerida && !vaiCriarRegra) { vm.fecharLinha(); return; }
    const novaRegra: lt.DadosDaRegra | undefined = vaiCriarRegra ? {
      tipo: sugestao.tipo, expressao: expressao.trim(), sentido: sugestao.sentido, conta,
      historico: r.historico.trim() !== lt.historicoLimpo(l.historicoDoBanco) ? r.historico.trim() : '', comHistoricoDoExtrato: false,
      codHistorico: r.codHistorico.trim(),
    } : undefined;
    if (vm.gravarLinha(l, r, novaRegra)) vm.fecharLinha();
  }

  return {
    r, mudar, entrada, fora, devedora, credora, faltam, problema, mudou, gravar, semPlano,
    regras, regra, aplicarRegra, semRegras,
    podeCriarRegra, criarRegra, setCriarRegra, expressao, setExpressao, tipoDaRegra: sugestao.tipo, casam, vaiCriarRegra, confirmaSugerida,
    pesquisando, abrirPesquisa: () => setPesquisando(true), fecharPesquisa: () => setPesquisando(false),
    escolherNaPesquisa: (codigo: string) => { setR(x => ({ ...x, conta: codigo })); setPesquisando(false); },
    data: vm.dataBR(l.data), valor: vm.valor(l.valor),
  };
}
