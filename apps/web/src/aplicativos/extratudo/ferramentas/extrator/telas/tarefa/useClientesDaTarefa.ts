// ViewModel da etapa Clientes da Tarefa (Vitor, 06/10/2026). Quatro telas, nas etapas de cima (o Segmentado) com o
// Próximo: Arquivos (só o balancete dinâmico: na 292, os 162 clientes têm o mesmo saldo do balancete; Vitor, 06/10/2026), Saldo credor (só quando tem: corrigir e reimportar o
// dinâmico), Clientes (todas as contas de cliente com o botão Pendente → Ok → Conferido e a observação do conferido) e
// Envio (a relação dos conferidos para o cliente: a planilha, o e-mail e o WhatsApp, com a mensagem configurável).
// As marcas ficam guardadas por mês; os conferidos do mês anterior aparecem de novo para revisar.
import { clientes as cl, conferencia as c, demo, tarefas } from '@nads/core';
import { baixarBytes, useRetorno } from '@nads/ui';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useDadosDeTesteNaTarefa, useRequisitosParaATarefa } from '../../../../../../comum/ponte';
import { modoDesenvolvedor } from '../../../../../../comum/modoDesenvolvedor';
import { gravarMensagem, lerMensagem, useMarcasDoMes } from '../../../../dados/clientes';
import { useSessao } from '../../casca/sessao';

export type TelaClientes = 'arquivos' | 'credor' | 'clientes' | 'envio';
export type FiltroClientes = 'todos' | 'pendente' | 'ok' | 'conferido';

const mesAntes = (m: string) => { const [a, mm] = m.split('-').map(Number); return mm === 1 ? (a - 1) + '-12' : a + '-' + String(mm - 1).padStart(2, '0'); };

export function useClientesDaTarefa() {
  const s = useSessao();
  const { aviso } = useRetorno();
  const [params] = useSearchParams();
  const meses = [...(params.get('meses') || '').split(','), params.get('competencia') || ''].filter(m => /^\d{4}-\d{2}$/.test(m)).sort();
  const mes = meses[meses.length - 1] || '';
  const [tela, setTela] = useState<TelaClientes>('arquivos');
  const [dinamico, setDinamico] = useState<{ nome: string; d: cl.BalanceteDinamico } | null>(null);
  const [filtro, setFiltro] = useState<FiltroClientes>('todos');
  const [busca, setBusca] = useState('');
  const [mensagem, setMensagem] = useState(lerMensagem);
  const avisar = (m: string) => aviso({ tom: 'erro', titulo: 'Clientes', texto: m });
  const marcas = useMarcasDoMes(s.nome, mes, avisar);
  const anterior = useMarcasDoMes(s.nome, mes ? mesAntes(mes) : '');

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

  // o ⚡ do modo desenvolvedor na Tarefa: um balancete dinâmico fictício do mês (com ou sem credores), como se importado
  const teste = useDadosDeTesteNaTarefa(mes && (modoDesenvolvedor() || demo.ehEmpresaDemo(s.nome)) && tela !== 'envio' ? [
    { id: 'dinamico', rotulo: 'Balancete dinâmico (sem credores)' },
    { id: 'dinamico-credores', rotulo: 'Balancete dinâmico (com saldo credor)' },
  ] : [], id => {
    const d = cl.dinamicoDeTeste(mes, id === 'dinamico-credores');
    setDinamico({ nome: 'balancete-dinamico-de-teste.xls', d });
    aviso({ tom: 'ok', titulo: 'Balancete dinâmico de teste', texto: 'Só nesta tela: nada vai para o banco.' });
  });

  const contas = useMemo(() => (dinamico && mes ? cl.clientesDoDinamico(dinamico.d, mes) : []), [dinamico, mes]);
  const credores = cl.credores(contas);
  const passam = cl.conferidosQuePassam(anterior.doc, marcas.doc);
  const linhas = contas.map(k => {
    const marca = marcas.doc.contas[k.codigo] || passam[k.codigo];
    const situacao = cl.situacaoDe(k, marca);
    return { codigo: k.codigo, nome: k.nome, saldo: k.saldo, situacao, obs: marca?.obs || '', doMesAnterior: !marcas.doc.contas[k.codigo] && !!passam[k.codigo] };
  });

  function marcar(codigo: string, mudar: (m: cl.MarcaDoCliente) => cl.MarcaDoCliente) {
    const l = linhas.find(x => x.codigo === codigo);
    if (!l || !marcas.carregado) return;
    const atual: cl.MarcaDoCliente = { nome: l.nome, saldo: l.saldo, situacao: l.situacao, ...(l.obs ? { obs: l.obs } : {}) };
    marcas.salvar({ contas: { ...marcas.doc.contas, [codigo]: mudar(atual) } });
  }

  const arquivosProntos = !!dinamico;
  const telas: TelaClientes[] = ['arquivos', ...(arquivosProntos && credores.length ? ['credor' as const] : []), 'clientes', 'envio'];
  const i = telas.indexOf(tela);
  const podeSeguir = tela === 'arquivos' ? arquivosProntos && contas.length > 0 : tela === 'credor' ? credores.length === 0 : tela === 'clientes';
  // na Tarefa: os arquivos e nenhum credor (a pessoa pode dar o check normal depois; os conferidos passam para o mês seguinte)
  const faltam = !arquivosProntos ? ['Importar o balancete dinâmico'] : credores.length ? ['Corrigir ' + credores.length + (credores.length === 1 ? ' cliente' : ' clientes') + ' com saldo credor'] : [];
  useRequisitosParaATarefa({ pronto: !faltam.length, faltam });

  const conferidos = linhas.filter(l => l.situacao === 'conferido');
  const paraCliente: cl.LinhaParaCliente[] = conferidos.map(l => ({ codigo: l.codigo, nome: l.nome, saldo: l.saldo, obs: l.obs }));
  const rotuloMes = mes ? tarefas.rotuloNumericoCompetencia(mes) : '';
  const texto = cl.textoDaMensagem(mensagem, s.nome, rotuloMes, paraCliente);
  const q = busca.trim().toLowerCase();
  const reais = (n: number) => 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return {
    mes: rotuloMes,
    tela: telas.includes(tela) ? tela : 'arquivos',
    telas: telas.map(t => ({ valor: t, rotulo: t === 'arquivos' ? 'Arquivos' : t === 'credor' ? 'Saldo credor' : t === 'clientes' ? 'Clientes' : 'Envio' })),
    irPara: (t: TelaClientes) => setTela(t),
    temProxima: i < telas.length - 1,
    podeSeguir,
    proximo: () => { if (podeSeguir && i < telas.length - 1) setTela(telas[i + 1]); },
    // Arquivos
    dinamico: dinamico ? { nome: dinamico.nome, resumo: contas.length + ' clientes · ' + rotuloMes } : null,
    importar: (f: File | undefined) => { void importar(f); },
    tirar: () => setDinamico(null),
    /** o ⚡ do modo desenvolvedor na linha */
    teste,
    // Saldo credor
    credores: credores.map(k => ({ codigo: k.codigo, nome: k.nome, saldo: reais(k.saldo) })),
    // Clientes
    carregado: marcas.carregado,
    filtro, setFiltro, busca, setBusca,
    contagem: { todos: linhas.length, pendente: linhas.filter(l => l.situacao === 'pendente').length, ok: linhas.filter(l => l.situacao === 'ok').length, conferido: conferidos.length },
    linhas: linhas
      .filter(l => filtro === 'todos' || l.situacao === filtro)
      .filter(l => !q || (l.codigo + ' ' + l.nome).toLowerCase().includes(q))
      .map(l => ({ ...l, valor: reais(l.saldo) })),
    clicar: (codigo: string) => marcar(codigo, m => ({ ...m, situacao: cl.proximaSituacao(m.situacao) })),
    // sem campo vazio (o banco não aceita undefined)
    observar: (codigo: string, obs: string) => marcar(codigo, m => ({ nome: m.nome, saldo: m.saldo, situacao: m.situacao, ...(obs.trim() ? { obs: obs.trim() } : {}) })),
    // Envio
    conferidos: conferidos.map(l => ({ codigo: l.codigo, nome: l.nome, valor: reais(l.saldo), obs: l.obs })),
    mensagem, texto,
    mudarMensagem: (t: string) => { setMensagem(t); gravarMensagem(t); },
    baixarPlanilha: () => baixarBytes(cl.planilhaParaCliente(paraCliente), 'clientes_' + (s.codigo ?? s.nome) + '_' + mes + '.xlsx', cl.TIPO_XLSX),
    email: 'mailto:?subject=' + encodeURIComponent('Clientes em aberto — ' + rotuloMes) + '&body=' + encodeURIComponent(texto),
    whatsapp: 'https://wa.me/?text=' + encodeURIComponent(texto),
  };
}
