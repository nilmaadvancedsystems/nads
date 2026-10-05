// O "Arquivar agora" na Tarefas, no banco do Entregas (05/10/2026) — o mesmo caminho das Pendências, nas regras de lá
// (só admin e contábil leem e pedem):
//   - solicitacoesArquivo: o pedido {status: 'pendente', modo: 'PRODUCAO', criadoEm, criadoPor, criadoPorUid} (só essas
//     chaves); cancelar = {status: 'cancelado', canceladoEm, canceladoPor} enquanto pendente ou aguardando. O arquivador
//     do PC escreve o resto no próprio pedido (aguardando, processando, progresso, andamento, concluido ou erro);
//   - robo/arquivador (só leitura): o ponto do PC (em) e o que ele está fazendo (situacao).
import { addDoc, collection, doc, limit, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import type { EstadoDoArquivador, PedidoDeArquivo, RepoArquivador } from './arquivador';
import { bancoDoEntregas } from './entregas.firestore';

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
  };
}

export function criarArquivadorFirestore(quem: () => Quem): RepoArquivador {
  const db = bancoDoEntregas();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  let estado: EstadoDoArquivador = { carregado: false, semPermissao: false, em: '', situacao: '', desligadoEm: '' };
  let pedidos: PedidoDeArquivo[] = [];
  let ouvindo = false;

  function ouvir() {
    if (ouvindo || !quem()) return;
    ouvindo = true;
    onSnapshot(doc(db, 'robo', 'arquivador'), s => {
      const d = s.data() || {};
      estado = { ...estado, carregado: true, em: texto(d.em), situacao: texto(d.situacao), desligadoEm: texto(d.desligadoEm) };
      mudou();
    }, () => { estado = { ...estado, carregado: true, semPermissao: true }; mudou(); });
    onSnapshot(query(collection(db, 'solicitacoesArquivo'), orderBy('criadoEm', 'desc'), limit(5)), s => {
      pedidos = s.docs.map(d => lerPedido(d.id, d.data()));
      mudou();
    }, () => { estado = { ...estado, carregado: true, semPermissao: true }; mudou(); });
  }

  return {
    exemplos: false,
    estado: () => { ouvir(); return estado; },
    pedidos: () => { ouvir(); return pedidos; },
    async pedir() {
      const q = quem();
      if (!q) throw new Error('Sem login.');
      await addDoc(collection(db, 'solicitacoesArquivo'), { status: 'pendente', modo: 'PRODUCAO', criadoEm: new Date().toISOString(), criadoPor: q.nome, criadoPorUid: q.uid });
    },
    async cancelar(id) {
      await updateDoc(doc(db, 'solicitacoesArquivo', id), { status: 'cancelado', canceladoEm: new Date().toISOString(), canceladoPor: quem()?.nome || '' });
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
