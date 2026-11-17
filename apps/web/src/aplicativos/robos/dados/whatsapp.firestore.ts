// O WhatsApp do robô no banco do Entregas (12/11/2026), sem regra nova:
//   robo/estado.whatsapp   a situação que o robô da nuvem escreve (robo/whatsapp.js); admin e contábil leem. A tela ouve o
//                          documento só enquanto a aba WhatsApp está aberta (ele muda a cada pedido da fila do Gmail)
//   solicitacoesEmail      os pedidos, na mesma fila do Gmail: tipo 'whatsapp-conectar' / 'whatsapp-desconectar' (o robô
//                          confere que é admin) e 'whatsapp' (a mensagem de teste para o número do escritório)
import { robos as r } from '@nads/core';
import { addDoc as addDocBruto, collection, doc, onSnapshot, serverTimestamp, type DocumentReference } from 'firebase/firestore';
import { guardarPedido } from '../../../comum/modoDesenvolvedor';
import { bancoDoEntregas, contaDoEntregas } from '../../tarefas/dados/entregas.firestore';
import type { RepoWhatsapp } from './whatsapp';

const addDoc = guardarPedido(addDocBruto) as typeof addDocBruto;
const ESPERA_MS = 60000;

/** Espera o robô responder no próprio pedido (feito, erro com o motivo, ou 'na-fila' depois de 1 minuto). */
function esperarORobo(ref: DocumentReference): Promise<'feito' | 'na-fila'> {
  return new Promise((ok, falha) => {
    const fim = setTimeout(() => { parar(); ok('na-fila'); }, ESPERA_MS);
    const parar = onSnapshot(ref, d => {
      const s = d.data() || {};
      if (s.status === 'enviado' || s.status === 'concluido') { clearTimeout(fim); parar(); ok('feito'); }
      if (s.status === 'erro') { clearTimeout(fim); parar(); falha(new Error(String(s.erro || 'o robô não fez'))); }
    }, e => { clearTimeout(fim); falha(e); });
  });
}

export function criarWhatsappFirestore(): RepoWhatsapp {
  const db = bancoDoEntregas();
  let w: r.WhatsappDoRobo = r.WHATSAPP_DESLIGADO;
  let ver = 0;
  let quantos = 0;
  let parar: (() => void) | null = null;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };

  async function pedir(dados: Record<string, unknown>, por: string) {
    const conta = contaDoEntregas();
    if (!conta) throw new Error('Entre com a conta do Entregas primeiro.');
    const ref = await addDoc(collection(db, 'solicitacoesEmail'), {
      ...dados, status: 'pendente', criadoEm: serverTimestamp(), criadoPor: por || 'Central dos robôs', criadoPorEmail: conta.email, criadoPorUid: conta.uid, origem: 'nads',
    });
    return esperarORobo(ref);
  }

  return {
    exemplos: false,
    situacao: () => w,
    acompanhar() {
      quantos++;
      if (!parar) {
        parar = onSnapshot(doc(db, 'robo', 'estado'), s => { w = r.lerWhatsappDoRobo((s.data() || {}).whatsapp, new Date()); mudou(); },
          () => { w = { ...r.WHATSAPP_DESLIGADO, motivo: 'sem acesso à situação do robô' }; mudou(); });
      }
      return () => {
        quantos--;
        if (quantos <= 0 && parar) { parar(); parar = null; quantos = 0; }
      };
    },
    comandar: (c, por) => pedir({ tipo: c === 'conectar' ? r.TIPOS_DO_WHATSAPP.conectar : r.TIPOS_DO_WHATSAPP.desconectar }, por),
    testar: (numero, texto, por) => pedir({ tipo: r.TIPOS_DO_WHATSAPP.enviar, para: numero, texto, clienteNome: 'Teste do escritório' }, por),
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
