// O acompanhamento do arquivador novo no banco do Entregas (só leitura; as regras deixam só o admin): robo/arquivadorNovo
// (o campo painel, que o robô do PC regrava no máximo a cada 45 s) ouvido enquanto a página está aberta, e o histórico de
// um dia (robo/arquivadorNovo/dias, as partes do dia) lido quando a aba Arquivados pede. O de hoje é relido quando o painel
// diz que o dia cresceu (no máximo a cada 2 min, para não baixar as partes a cada gravação do robô).
// Os pedidos ao robô (23/10/2026): pedidosArquivador (só o admin cria, com a hora do servidor), ouvido do pedido até a
// resposta; o arquivo aberto vem em pedidosArquivador/{id}/partes (base64); os clientes e os tipos do formulário em
// robo/arquivadorNovoCadastro (lido uma vez por abertura do formulário, no máximo a cada 30 min).
import { entregas as e } from '@nads/core';
import { addDoc as addDocBruto, collection, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, where } from 'firebase/firestore';
import { guardarPedido } from '../../../comum/modoDesenvolvedor';
import { bancoDoEntregas } from '../../tarefas/dados/entregas.firestore';
import { quemPede } from '../../tarefas/dados/fonte';
import { hojeLocal, type DiaDoArquivador, type DocsDoArquivadorNovo, type MesCarregado, type RepoArquivadorNovo } from './arquivadorNovo';

const RELER_HOJE_MS = 2 * 60 * 1000;
const RELER_MES_MS = 5 * 60 * 1000;
const RELER_CADASTRO_MS = 30 * 60 * 1000;
const FINAIS: readonly string[] = ['pronto', 'feito', 'erro'];
const addDoc = guardarPedido(addDocBruto) as typeof addDocBruto;
const negado = (err: unknown) => /permission|insufficient/i.test(err instanceof Error ? err.message : String(err));

export function criarArquivadorNovoFirestore(): RepoArquivadorNovo {
  const db = bancoDoEntregas();
  let docs: DocsDoArquivadorNovo = { carregado: false, semPermissao: false, painel: null };
  const dias = new Map<string, DiaDoArquivador & { lidoEm: number; itensNoPainel: number; lendo: boolean }>();
  let ver = 0;
  let quantos = 0;
  let parar: (() => void) | null = null;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  let cadastro: e.CadastroDoFormulario = { carregado: false, em: '', clientes: [], tipos: [] };
  let cadastroLidoEm = 0;
  const pedidos = new Map<string, e.PedidoDoArquivador>();
  // os resumos dos meses (robo/arquivadorNovo/meses/{AAAA-MM}; 23/10/2026)
  const meses = new Map<string, MesCarregado & { lidoEm: number; lendo: boolean }>();
  async function lerMes(mes: string) {
    const atual = meses.get(mes);
    if (!atual || atual.lendo) return;
    atual.lendo = true;
    try {
      const s = await getDoc(doc(db, 'robo', 'arquivadorNovo', 'meses', mes));
      meses.set(mes, { ...atual, carregado: true, erro: '', resumo: e.lerMesDoArquivador(s.exists() ? s.data() : null), lidoEm: Date.now(), lendo: false });
    } catch (err) {
      meses.set(mes, { ...atual, carregado: true, erro: negado(err) ? 'Sem acesso ao resumo do mês.' : 'Não consegui ler o resumo do mês: ' + (err instanceof Error ? err.message : String(err)), lidoEm: Date.now(), lendo: false });
    }
    mudou();
  }

  async function lerDia(dia: string) {
    const atual = dias.get(dia);
    if (!atual || atual.lendo) return;
    atual.lendo = true;
    try {
      const snap = await getDocs(query(collection(db, 'robo', 'arquivadorNovo', 'dias'), where('dia', '==', dia)));
      const partes = snap.docs.map(d => e.lerParteDoDia(d.data())).sort((a, b) => a.parte - b.parte);
      const itens = partes.flatMap(p => p.itens).sort((a, b) => b.em.localeCompare(a.em));
      dias.set(dia, { ...atual, carregado: true, erro: '', itens, lidoEm: Date.now(), lendo: false });
    } catch (err) {
      dias.set(dia, { ...atual, carregado: true, erro: negado(err) ? 'Sem acesso ao histórico do arquivador.' : 'Não consegui ler o histórico do dia: ' + (err instanceof Error ? err.message : String(err)), lidoEm: Date.now(), lendo: false });
    }
    mudou();
  }

  return {
    exemplos: false,
    docs: () => docs,
    acompanhar() {
      quantos++;
      if (!parar) {
        parar = onSnapshot(doc(db, 'robo', 'arquivadorNovo'), s => {
          docs = { carregado: true, semPermissao: false, painel: e.lerPainelDoArquivador(s.exists() ? s.data() : null) };
          // o histórico de hoje cresceu: relê (com folga)
          const h = docs.painel?.historico;
          const hoje = h?.dia ? dias.get(h.dia) : undefined;
          if (h && hoje && h.itens !== hoje.itensNoPainel && Date.now() - hoje.lidoEm > RELER_HOJE_MS) { hoje.itensNoPainel = h.itens; void lerDia(h.dia); }
          mudou();
        }, err => { docs = { carregado: true, semPermissao: negado(err), painel: docs.painel }; mudou(); });
      }
      return () => {
        quantos--;
        if (!quantos && parar) { parar(); parar = null; }
      };
    },
    dia(dia) {
      let d = dias.get(dia);
      if (!d) {
        d = { dia, carregado: false, erro: '', itens: [], lidoEm: 0, itensNoPainel: dia === hojeLocal() ? docs.painel?.historico.itens ?? 0 : 0, lendo: false };
        dias.set(dia, d);
        void lerDia(dia);
      }
      return d;
    },
    mes(mes) {
      let m = meses.get(mes);
      if (!m) { m = { mes, carregado: false, erro: '', resumo: null, lidoEm: 0, lendo: false }; meses.set(mes, m); void lerMes(mes); }
      else if (mes === hojeLocal().slice(0, 7) && Date.now() - m.lidoEm > RELER_MES_MS) void lerMes(mes);
      return m;
    },
    cadastroDoFormulario() {
      if (Date.now() - cadastroLidoEm > RELER_CADASTRO_MS) {
        cadastroLidoEm = Date.now();
        getDoc(doc(db, 'robo', 'arquivadorNovoCadastro'))
          .then(s => { cadastro = s.exists() ? e.lerCadastroDoFormulario(s.data()) : { carregado: true, em: '', clientes: [], tipos: [] }; mudou(); })
          .catch(() => { cadastro = { carregado: true, em: '', clientes: [], tipos: [] }; cadastroLidoEm = 0; mudou(); });
      }
      return cadastro;
    },
    async pedir(n) {
      const q = quemPede();
      if (!q) throw new Error('entre com a sua conta para pedir ao robô');
      const dados: Record<string, unknown> = { tipo: n.tipo, rel: n.rel, hash: n.hash, status: 'pendente', criadoEm: serverTimestamp(), pedidoPor: q.nome.slice(0, 80), pedidoPorUid: q.uid };
      if (n.nome) dados.nome = n.nome.slice(0, 200);
      if (n.codigo != null) dados.codigo = n.codigo;
      if (n.tipoDoc) dados.tipoDoc = n.tipoDoc;
      if (n.competencia) dados.competencia = n.competencia;
      if (n.lembrar === true && n.tipo === 'grupo') dados.lembrar = true;
      const ref = await addDoc(collection(db, 'pedidosArquivador'), dados);
      pedidos.set(ref.id, { id: ref.id, tipo: n.tipo, status: 'pendente', erro: '', resposta: null, arquivo: null });
      mudou();
      // ouvido até a resposta (pronto, feito ou erro)
      const pararPedido = onSnapshot(ref, s => {
        const p = e.lerPedidoDoArquivador(ref.id, s.exists() ? s.data() : null);
        if (p) { pedidos.set(ref.id, p); mudou(); if (FINAIS.includes(p.status)) pararPedido(); }
      }, () => { pedidos.set(ref.id, { id: ref.id, tipo: n.tipo, status: 'erro', erro: 'perdi a resposta do robô: tente de novo', resposta: null, arquivo: null }); mudou(); });
      return ref.id;
    },
    pedido: id => pedidos.get(id) || null,
    async conteudo(id, partes) {
      const snap = await getDocs(collection(db, 'pedidosArquivador', id, 'partes'));
      const pedacos = snap.docs.map(d => ({ n: Number(d.data().n), dados: String(d.data().dados || '') })).sort((a, b) => a.n - b.n);
      if (pedacos.length < partes) throw new Error('o arquivo chegou incompleto (' + pedacos.length + ' de ' + partes + ' partes): tente de novo');
      const bytes = pedacos.map(p => Uint8Array.from(atob(p.dados), c => c.charCodeAt(0)));
      const out = new Uint8Array(bytes.reduce((t, b) => t + b.length, 0));
      let pos = 0;
      for (const b of bytes) { out.set(b, pos); pos += b.length; }
      return out;
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
