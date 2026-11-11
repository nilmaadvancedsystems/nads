// O formulário do Mandei no banco do Entregas (11/11/2026), SEM LOGIN, no mesmo app Firebase do site do cliente (só o
// Firestore). O que as regras publicadas em 07/10/2026 deixam o cliente fazer (docs/mandei/regras-do-banco.md):
//   ler      ticketsLinks/{código} (só aquele documento; listar é proibido);
//   gravar   nele, enquanto o link vale (a hora do servidor) e não está fechado, só abertoEm, respostas, respondidoEm e
//            arquivos (até 300 respostas e 100 arquivos);
//   criar    enviosSecretario { status: 'enviando', nome, tamanho, partes, competencia, cliente, codigo, criadoEm,
//            criadoPor, criadoPorUid: 'mandei', ticket: o código do link }, os pedaços em partes/{n} ({ dados }, até 950 KB)
//            e passar para 'pendente'; o robô grava no Drive (Claudio Secretario) e a equipe acompanha.
// As respostas que o cliente grava passam pelo core (aplicarRespostas: só as chaves e as opções do formulário).
import { mandei as m } from '@nads/core';
import { addDoc, arrayUnion, Bytes, collection, doc, onSnapshot, setDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { bancoDoCliente } from '../../cliente/dados/areaCliente.firestore';
import type { RepoFormulario } from './formulario';

const PEDACO = 900 * 1024;
const MAIOR = 25 * 1024 * 1024;

const comoData = (v: unknown): string => (v instanceof Timestamp ? v.toDate().toISOString() : typeof v === 'string' ? v : '');

function mensagem(e: unknown): string {
  const codigo = (e as { code?: string } | null)?.code ?? '';
  if (codigo === 'permission-denied') return 'Este link não aceita mais respostas. Se precisar, fale com o escritório.';
  if (codigo === 'unavailable') return 'Sem conexão agora. Confira a internet e tente de novo.';
  return 'Não deu para gravar agora. Tente de novo em instantes.';
}
const comMensagem = async (f: () => Promise<unknown>) => { try { await f(); } catch (e) { throw new Error(mensagem(e), { cause: e }); } };

export function criarFormularioFirestore(): RepoFormulario {
  const ultimo = new Map<string, m.DocDoLink>();
  const db = () => bancoDoCliente();
  const ref = (codigo: string) => doc(db(), 'ticketsLinks', codigo);

  return {
    assinar(codigo, aoMudar) {
      if (!/^[A-Za-z0-9]{10,40}$/.test(codigo)) { aoMudar({ carregado: true, doc: null, erro: '' }); return () => undefined; }
      return onSnapshot(ref(codigo), s => {
        const raw = s.data();
        const d = raw ? m.lerDocDoLink({ ...raw, validoAte: comoData(raw.validoAte) }) : null;
        if (d) ultimo.set(codigo, d);
        aoMudar({ carregado: true, doc: d, erro: '' });
      }, e => aoMudar({ carregado: true, doc: null, erro: (e as { code?: string }).code === 'permission-denied' ? '' : mensagem(e) }));
    },
    async abriu(codigo) {
      await comMensagem(() => updateDoc(ref(codigo), { abertoEm: new Date().toISOString() }));
    },
    async rascunho(codigo, respostas) {
      const d = ultimo.get(codigo);
      if (!d) return;
      await comMensagem(() => updateDoc(ref(codigo), { respostas: m.aplicarRespostas(d.itens, {}, respostas) }));
    },
    async enviar(codigo, respostas) {
      const d = ultimo.get(codigo);
      if (!d) throw new Error('O formulário ainda não carregou.');
      await comMensagem(() => updateDoc(ref(codigo), { respostas: m.aplicarRespostas(d.itens, {}, respostas), respondidoEm: new Date().toISOString() }));
    },
    async anexar(codigo, chave, f) {
      const d = ultimo.get(codigo);
      if (!d) throw new Error('O formulário ainda não carregou.');
      if (f.size <= 0) throw new Error(f.name + ': o arquivo está vazio.');
      if (f.size > MAIOR) throw new Error(f.name + ': maior que 25 MB.');
      const bytes = new Uint8Array(await f.arrayBuffer());
      const partes = Math.ceil(bytes.length / PEDACO);
      const nome = ('Mandei ' + d.numero + ' - ' + f.name).slice(0, 200);
      await comMensagem(async () => {
        // o envio: cria ('enviando'), sobe os pedaços e passa para 'pendente' (o robô grava no Drive)
        const envio = await addDoc(collection(db(), 'enviosSecretario'), {
          status: 'enviando', nome, tamanho: bytes.length, partes, competencia: d.envio.competencia, cliente: d.envio.cliente, codigo: d.envio.codigo,
          criadoEm: new Date().toISOString(), criadoPor: 'Cliente (Mandei ' + d.numero + ')', criadoPorUid: 'mandei', ticket: codigo,
        });
        for (let n = 0; n < partes; n++) {
          await setDoc(doc(db(), 'enviosSecretario', envio.id, 'partes', String(n)), { dados: Bytes.fromUint8Array(bytes.subarray(n * PEDACO, (n + 1) * PEDACO)) });
        }
        await updateDoc(envio, { status: 'pendente' });
        // e na lista do formulário, na resposta dele
        await updateDoc(ref(codigo), { arquivos: arrayUnion({ id: envio.id, nome: f.name.slice(0, 200), tamanho: bytes.length, itemId: chave, enviadoEm: new Date().toISOString() }) });
      });
    },
    maiorArquivo: MAIOR, limite: '25 MB',
  };
}
