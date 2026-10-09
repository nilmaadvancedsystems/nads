// O "Arquivar agora" na Tarefas, no banco do Entregas (05/10/2026) — o mesmo caminho das Pendências, nas regras de lá
// (só admin e contábil leem e pedem):
//   - solicitacoesArquivo: o pedido {status: 'pendente', modo: 'PRODUCAO', criadoEm, criadoPor, criadoPorUid} (só essas
//     chaves); cancelar = {status: 'cancelado', canceladoEm, canceladoPor} enquanto pendente ou aguardando. O arquivador
//     do PC escreve o resto no próprio pedido (aguardando, processando, progresso, andamento, concluido ou erro);
//   - robo/arquivador (só leitura): o ponto do PC (em) e o que ele está fazendo (situacao);
//   - arquivamentos/{execucao} (só leitura): o resumo da execução (arquivados, não identificados, clientes); as 15
//     últimas somam as rodadas do dia no painel;
//   - robo/arquivador.rotina: a rotina rodando por fora do botão (a das 9h), que o arquivador manda no ponto;
//   - robo/arquivadorConversa (só leitura): a conversa do Claude que roda a rotina e o relatório do dia;
//   - arquivadorParar (09/10/2026, quem pede o arquivamento): parar a organização que está rodando; o arquivador do PC
//     encerra o Claude que organiza e marca o pedido como cancelado;
//   - arquivadorMensagens (07/10/2026, só o admin): o que se escreve para o Claude da rotina; o arquivador do PC retoma a
//     sessão com a mensagem e escreve o andamento (status, erro) no próprio documento;
//   - arquivamentos/{execucao}/detalhe/tudo (só leitura, quando pedem): o relatório e a mensagem final da execução.
import { addDoc as addDocBruto, collection, doc, getDoc, limit, onSnapshot, orderBy, query, updateDoc as updateDocBruto } from 'firebase/firestore';
import type { ConversaDaRotina, DetalheDaExecucao, EstadoDoArquivador, ExecucaoPublicada, MensagemParaOClaude, PedidoDeArquivo, RepoArquivador, ResultadoDoArquivamento, RotinaRodando } from './arquivador';
import { bancoDoEntregas } from './entregas.firestore';
import { guardar, guardarPedido } from '../../../comum/modoDesenvolvedor';

// a trava do modo desenvolvedor (comum/modoDesenvolvedor.ts): com o modo ligado, só ver — nada é gravado
const addDoc = guardarPedido(addDocBruto) as typeof addDocBruto;
const updateDoc = guardar(updateDocBruto) as typeof updateDocBruto;

type Quem = { nome: string; uid: string } | null;
const texto = (v: unknown) => (v == null ? '' : String(v));

function lerPedido(id: string, x: Record<string, unknown>): PedidoDeArquivo {
  const g = x.progresso as { feitas?: unknown; total?: unknown; atual?: unknown } | undefined;
  return {
    id, status: texto(x.status), criadoPor: texto(x.criadoPor), criadoEm: texto(x.criadoEm), processandoEm: texto(x.processandoEm),
    concluidoEm: texto(x.concluidoEm), erroEm: texto(x.erroEm), canceladoEm: texto(x.canceladoEm), aguardandoMotivo: texto(x.aguardandoMotivo),
    erro: texto(x.erro), passos: Number(x.passos) || 0,
    progresso: g && Number(g.total) ? { feitas: Number(g.feitas) || 0, total: Number(g.total), atual: texto(g.atual) } : null,
    andamento: Array.isArray(x.andamento) ? (x.andamento as Record<string, unknown>[]).map(l => ({ em: texto(l.em), texto: texto(l.texto), sub: !!l.sub })) : [],
    execucao: texto(x.execucao),
  };
}

export function criarArquivadorFirestore(quem: () => Quem): RepoArquivador {
  const db = bancoDoEntregas();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  let estado: EstadoDoArquivador = { carregado: false, semPermissao: false, em: '', situacao: '', desligadoEm: '', rotina: null };
  let execucoes: ExecucaoPublicada[] = [];
  let conversa: ConversaDaRotina = { carregada: false, atualizadaEm: '', sessao: '', mensagens: [], relatorio: null, agentes: [] };
  let escritas: MensagemParaOClaude[] = [];
  let ouvindoEscritas = false;
  const detalhes = new Map<string, DetalheDaExecucao>();
  let pedidos: PedidoDeArquivo[] = [];
  let ouvindo = false;
  const resultados = new Map<string, ResultadoDoArquivamento | null>();

  function ouvir() {
    if (ouvindo || !quem()) return;
    ouvindo = true;
    onSnapshot(doc(db, 'robo', 'arquivador'), s => {
      const d = s.data() || {};
      const r = d.rotina as Record<string, unknown> | null | undefined;
      const rotina: RotinaRodando | null = r ? {
        ativa: !!r.ativa, execucao: texto(r.execucao), inicio: texto(r.inicio), modo: texto(r.modo), fase: texto(r.fase),
        ultimoSinalEm: texto(r.ultimoSinalEm), deUmPedido: !!r.deUmPedido,
      } : null;
      estado = { ...estado, carregado: true, em: texto(d.em), situacao: texto(d.situacao), desligadoEm: texto(d.desligadoEm), rotina };
      mudou();
    }, () => { estado = { ...estado, carregado: true, semPermissao: true }; mudou(); });
    onSnapshot(query(collection(db, 'solicitacoesArquivo'), orderBy('criadoEm', 'desc'), limit(5)), s => {
      pedidos = s.docs.map(d => lerPedido(d.id, d.data()));
      mudou();
    }, () => { estado = { ...estado, carregado: true, semPermissao: true }; mudou(); });
    onSnapshot(doc(db, 'robo', 'arquivadorConversa'), s => {
      const d = s.data() || {};
      const rel = d.relatorio as Record<string, unknown> | null | undefined;
      conversa = {
        carregada: true, atualizadaEm: texto(d.atualizadaEm), sessao: texto(d.sessao),
        mensagens: Array.isArray(d.mensagens) ? (d.mensagens as Record<string, unknown>[]).map(m => ({ em: texto(m.em), quem: m.quem === 'voce' ? 'voce' as const : 'claude' as const, texto: texto(m.texto) })) : [],
        relatorio: rel ? { arquivo: texto(rel.arquivo), em: texto(rel.em), texto: texto(rel.texto) } : null,
        agentes: Array.isArray(d.agentes) ? (d.agentes as Record<string, unknown>[]).map(a => ({
          id: texto(a.id), descricao: texto(a.descricao), tipo: texto(a.tipo), em: texto(a.em),
          status: a.status === 'concluido' ? 'concluido' as const : a.status === 'erro' ? 'erro' as const : 'rodando' as const,
        })) : [],
      };
      mudou();
    }, () => { conversa = { ...conversa, carregada: true }; mudou(); });
    onSnapshot(query(collection(db, 'arquivamentos'), orderBy('em', 'desc'), limit(15)), s => {
      execucoes = s.docs.map(d => {
        const x = d.data();
        return { id: d.id, em: texto(x.em), arquivados: Number(x.arquivados) || 0, naoIdentificados: Number(x.naoIdentificados) || 0,
          codigos: Array.isArray(x.codigos) ? (x.codigos as unknown[]).map(texto) : [] };
      });
      mudou();
    }, () => undefined);
  }

  return {
    exemplos: false,
    estado: () => { ouvir(); return estado; },
    pedidos: () => { ouvir(); return pedidos; },
    execucoesRecentes: () => { ouvir(); return execucoes; },
    conversa: () => { ouvir(); return conversa; },
    mensagens() {
      // só o admin lê (as regras do Entregas); quem não pode fica sem a lista, sem erro na tela
      if (!ouvindoEscritas && quem()) {
        ouvindoEscritas = true;
        onSnapshot(query(collection(db, 'arquivadorMensagens'), orderBy('criadoEm', 'desc'), limit(8)), s => {
          escritas = s.docs.map(d => { const x = d.data(); return { id: d.id, texto: texto(x.texto), status: texto(x.status), erro: texto(x.erro), criadoEm: texto(x.criadoEm), criadoPor: texto(x.criadoPor) }; });
          mudou();
        }, () => undefined);
      }
      return escritas;
    },
    async mandarMensagem(t, sessao) {
      const q = quem();
      if (!q) throw new Error('Sem login.');
      await addDoc(collection(db, 'arquivadorMensagens'), { status: 'pendente', texto: t, sessao, criadoEm: new Date().toISOString(), criadoPor: q.nome, criadoPorUid: q.uid });
    },
    detalhe(execucao) {
      const pronto = detalhes.get(execucao);
      if (pronto) return pronto;
      const vazio: DetalheDaExecucao = { carregado: false, relatorio: '', resposta: '' };
      detalhes.set(execucao, vazio);
      getDoc(doc(db, 'arquivamentos', execucao, 'detalhe', 'tudo')).then(s => {
        const d = s.data() || {};
        detalhes.set(execucao, { carregado: true, relatorio: texto(d.relatorio), resposta: texto(d.resposta) });
        mudou();
      }, () => { detalhes.set(execucao, { carregado: true, relatorio: '', resposta: '' }); mudou(); });
      return vazio;
    },
    resultado(execucao) {
      if (!execucao) return null;
      if (!resultados.has(execucao)) {
        resultados.set(execucao, null);
        onSnapshot(doc(db, 'arquivamentos', execucao), s => {
          const d = s.data();
          if (!d) return;
          resultados.set(execucao, {
            arquivados: Number(d.arquivados) || 0, naoIdentificados: Number(d.naoIdentificados) || 0, duplicados: Number(d.duplicados) || 0,
            clientes: Array.isArray(d.clientes) ? (d.clientes as Record<string, unknown>[]).map(c => ({ codigo: texto(c.codigo), nome: texto(c.nome), n: Number(c.n) || 0 })) : [],
          });
          mudou();
        }, () => undefined);
      }
      return resultados.get(execucao) || null;
    },
    async pedir() {
      const q = quem();
      if (!q) throw new Error('Sem login.');
      await addDoc(collection(db, 'solicitacoesArquivo'), { status: 'pendente', modo: 'PRODUCAO', criadoEm: new Date().toISOString(), criadoPor: q.nome, criadoPorUid: q.uid });
    },
    async pararOrganizacao() {
      const q = quem();
      if (!q) throw new Error('Sem login.');
      await addDoc(collection(db, 'arquivadorParar'), { status: 'pendente', criadoEm: new Date().toISOString(), criadoPor: q.nome, criadoPorUid: q.uid });
    },
    async cancelar(id) {
      await updateDoc(doc(db, 'solicitacoesArquivo', id), { status: 'cancelado', canceladoEm: new Date().toISOString(), canceladoPor: quem()?.nome || '' });
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
