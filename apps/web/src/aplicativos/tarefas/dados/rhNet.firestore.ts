// Os pedidos ao RH NET no banco do Entregas (25/11/2026): a fila de sempre do robô da nuvem (solicitacoesEmail, tipo 'rhnet'),
// como os pedidos do WhatsApp; nada de coleção nova. A tela ouve só os pedidos do tipo 'rhnet' (poucos: o robô do nads não
// guarda os dados pessoais depois de atender).
import { sci } from '@nads/core';
import { addDoc as addDocBruto, collection, limit, onSnapshot, query, serverTimestamp, where } from 'firebase/firestore';
import { bancoDoEntregas, contaDoEntregas } from './entregas.firestore';
import { pedidoRhNetDoBanco, type AcaoDoRhNet, type PedidoRhNet, type RepoRhNet } from './rhNet';
import { guardarPedido } from '../../../comum/modoDesenvolvedor';

const addDoc = guardarPedido(addDocBruto) as typeof addDocBruto;

export function criarRhNetFirestore(quem: () => string): RepoRhNet {
  const db = bancoDoEntregas();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  let estado: { carregados: boolean; lista: PedidoRhNet[] } = { carregados: false, lista: [] };
  let ouvindo = false;

  async function pedir(codigo: number, acao: AcaoDoRhNet, dados?: Record<string, unknown>) {
    const conta = contaDoEntregas();
    if (!conta) throw new Error('Entre com a conta do Entregas primeiro.');
    await addDoc(collection(db, 'solicitacoesEmail'), {
      tipo: 'rhnet', acao, codigo, ...(dados ? { dados } : {}), status: 'pendente', criadoEm: serverTimestamp(),
      criadoPor: quem() || 'nads', criadoPorEmail: conta.email, criadoPorUid: conta.uid, origem: 'nads',
    });
  }

  return {
    exemplos: false,
    pedidos() {
      if (!ouvindo) {
        ouvindo = true;
        onSnapshot(query(collection(db, 'solicitacoesEmail'), where('tipo', '==', 'rhnet'), limit(50)), s => {
          const lista = s.docs.map(d => pedidoRhNetDoBanco(d.id, d.data())).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
          estado = { carregados: true, lista };
          mudou();
        }, () => { estado = { carregados: true, lista: [] }; mudou(); });
      }
      return estado;
    },
    pedirCadastros: codigo => pedir(codigo, 'cadastros'),
    async pedirAdmissao(codigo, a) {
      const erro = sci.integracao.erroDaAdmissao(a);
      if (erro) throw new Error(erro);
      await pedir(codigo, 'admissao', { admissao: { ...a } });
    },
    pedirExclusao: (codigo, id, chamadoId) => pedir(codigo, 'excluirAdmissao', { id, ...(chamadoId ? { chamadoId } : {}) }),
    pedirLiberacao: (codigo, ids, situacao, chamadoId) => pedir(codigo, 'liberarAdmissao', { ids, situacao, ...(chamadoId ? { chamadoId } : {}) }),
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
