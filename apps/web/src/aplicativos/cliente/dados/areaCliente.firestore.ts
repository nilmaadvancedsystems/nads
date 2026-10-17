// A Área do Cliente no banco (17/10/2026; contrato em docs/area-do-cliente/contrato.md): o espelho areasCliente/{token}
// no Firestore do Entregas (entregas-2e5e2), SEM LOGIN. Um app Firebase só do site do cliente ('cliente'), só com o
// Firestore: o Auth nunca é carregado e nenhuma coleção interna é lida. O que as regras do banco deixam (bloco "Área do
// Cliente" do firestore.rules do Entregas):
//   ler   areasCliente/{token} (get, só se o link existe) e, enquanto ele existir, resumo/atual, guias (+ guias/{id}/pdf/{n},
//         n de 0), agenda/{AAAA-MM}, envios e chamados;
//   criar areaClienteChamados { token, chamadoId?, tipo, titulo?, texto, criadoEm } e
//         areaClienteEnvios { token, nome, tipo, mime, tamanho, base64 (até 700 KB), criadoEm } — as chaves exatas da regra.
// Link que não existe ou foi revogado: o banco recusa (permission-denied) e a tela mostra "link inválido"; revogado com a
// página aberta, a tela troca na hora. Do documento do link só sai o nome (para o topo, enquanto o robô não grava o
// resumo); os códigos e quem criou ficam fora da tela. A leitura campo a campo e os pedidos estão em espelho.ts.
import { getApps, initializeApp } from 'firebase/app';
import { addDoc, collection, doc, getDocs, getFirestore, initializeFirestore, onSnapshot, serverTimestamp, type Firestore, type FirestoreError } from 'firebase/firestore';
import { areaCliente as ac } from '@nads/core';
import { AREA_VAZIA, type EstadoDaArea, type RepoAreaCliente } from './areaCliente';
import {
  base64DosBytes, ehTokenDoLink, estadoDoEspelho, lerAgenda, lerChamado, lerGuia, lerRecibo, lerResumo, nomeDoPdfDaGuia, pedidoDeChamado, pedidoDeEnvio, respostaVoltou,
  type ChamadoPendente, type PartesDoEspelho, type RespostaPendente,
} from './espelho';
import { juntarPedacosDoPdf, type PedacoDoPdf } from './regras';

/** Configuração web pública do projeto do Entregas (a mesma das páginas de lá). */
const CONFIG_ENTREGAS = {
  apiKey: 'AIzaSyD6xg7XhX8dKTKmaYup4hRX5k9XFHEkb98',
  authDomain: 'entregas-2e5e2.firebaseapp.com',
  projectId: 'entregas-2e5e2',
  storageBucket: 'entregas-2e5e2.firebasestorage.app',
  messagingSenderId: '1009094556836',
  appId: '1:1009094556836:web:d3b6a9283e934db064fa31',
};

/** O banco, aberto na primeira vez que alguém precisa (o token "exemplo" nunca abre). */
function bancoDoCliente(): Firestore {
  const app = getApps().find(a => a.name === 'cliente') ?? initializeApp(CONFIG_ENTREGAS, 'cliente');
  try {
    return initializeFirestore(app, { ignoreUndefinedProperties: true });
  } catch {
    return getFirestore(app); // já aberto nesta página
  }
}

const LINK_RUIM = 'Este link não vale mais. Peça um novo ao escritório.';
/** a mensagem do erro do banco para o cliente: o link revogado ou a internet */
function mensagemDoErro(e: unknown): string {
  const codigo = (e as { code?: string } | null)?.code ?? '';
  return codigo === 'permission-denied' ? LINK_RUIM : 'Não deu para mandar agora. Confira a internet e tente de novo.';
}
/** o link não existe, foi revogado ou trocado: as regras recusam a leitura */
const linkRecusado = (e: FirestoreError) => e.code === 'permission-denied' || e.code === 'not-found';

export function criarRepoAreaClienteFirestore(banco: () => Firestore = bancoDoCliente): RepoAreaCliente {
  let db: Firestore | null = null;
  const abrir = () => (db ??= banco());

  // o que o cliente mandou nesta página e o robô ainda não devolveu pelo espelho (por token)
  const novos = new Map<string, ChamadoPendente[]>();
  const respostas = new Map<string, RespostaPendente[]>();
  // o último espelho de cada token (o tipo do chamado na resposta, o nome do PDF da guia) e quem redesenhar
  const ultimo = new Map<string, PartesDoEspelho>();
  const redesenhar = new Map<string, Set<() => void>>();
  const avisarToken = (token: string) => redesenhar.get(token)?.forEach(f => f());

  return {
    assinar(token, aoMudar) {
      if (!ehTokenDoLink(token)) { aoMudar({ ...AREA_VAZIA, carregado: true }); return () => undefined; }
      const banco = abrir();
      const espelho = doc(banco, 'areasCliente', token);
      const paradas: (() => void)[] = [];
      let parado = false;
      let nomeDoLink = '';
      // undefined = ainda não chegou
      const partes: { resumo?: ac.ResumoDoCliente | null; guias?: ac.GuiaDoCliente[]; agenda?: ac.AgendaDoMes[]; envios?: ac.ReciboDeEnvio[]; chamados?: ac.ChamadoDoCliente[] } = {};

      const parar = () => { parado = true; paradas.splice(0).forEach(f => f()); redesenhar.get(token)?.delete(desenhar); };
      const mostrar = (e: EstadoDaArea) => { if (!parado) aoMudar(e); };
      // depois de parar (a tela saiu, ou já mostrou o link inválido), nada mais chega à tela
      const invalido = () => { if (parado) return; parar(); aoMudar({ ...AREA_VAZIA, carregado: true }); };
      const falhou = (e: FirestoreError) => {
        if (linkRecusado(e)) { invalido(); return; }
        if (parado) return;
        parar();
        aoMudar({ ...AREA_VAZIA, carregado: true, erro: 'Não deu para abrir a sua área agora. Tente de novo em alguns minutos.' });
      };
      function desenhar() {
        const { resumo, guias, agenda, envios, chamados } = partes;
        if (resumo === undefined || !guias || !agenda || !envios || !chamados) return;
        const p: PartesDoEspelho = { resumo, nomeDoLink, guias, agenda, envios, chamados };
        ultimo.set(token, p);
        // o que já voltou pelo espelho sai da lista dos pendentes
        novos.set(token, (novos.get(token) ?? []).filter(n => !chamados.some(c => c.id === n.id)));
        respostas.set(token, (respostas.get(token) ?? []).filter(r => !respostaVoltou(r, chamados)));
        mostrar(estadoDoEspelho(p, novos.get(token), respostas.get(token)));
      }
      if (!redesenhar.has(token)) redesenhar.set(token, new Set());
      redesenhar.get(token)!.add(desenhar);

      /** uma subcoleção do espelho ao vivo: cada documento lido e conferido (o torto fica de fora) */
      function ouvirColecao<T>(nome: string, ler: (id: string, x: unknown) => T | null, guardar: (l: T[]) => void) {
        paradas.push(onSnapshot(collection(espelho, nome), s => {
          guardar(s.docs.map(d => ler(d.id, d.data())).filter((x): x is T => x != null));
          desenhar();
        }, falhou));
      }

      let ouvindoEspelho = false;
      // primeiro o link: só com ele de pé o resto é ouvido (link ruim = um só "permission-denied", não seis)
      paradas.push(onSnapshot(espelho, s => {
        if (!s.exists()) { invalido(); return; }
        const nome = s.get('nome');
        nomeDoLink = typeof nome === 'string' ? nome.trim() : '';
        if (ouvindoEspelho) { desenhar(); return; }
        ouvindoEspelho = true;
        paradas.push(onSnapshot(doc(espelho, 'resumo', 'atual'), r => { partes.resumo = r.exists() ? lerResumo(r.data()) : null; desenhar(); }, falhou));
        ouvirColecao('guias', lerGuia, l => { partes.guias = l; });
        ouvirColecao('agenda', lerAgenda, l => { partes.agenda = l; });
        ouvirColecao('envios', lerRecibo, l => { partes.envios = l; });
        ouvirColecao('chamados', lerChamado, l => { partes.chamados = l; });
      }, falhou));
      return parar;
    },

    async abrirChamado(token, { tipo, texto }) {
      // a foto da admissão não vai: a caixa do banco ainda não tem campo para ela (e o Departamento pessoal está escondido)
      const p = pedidoDeChamado(token, { tipo, texto });
      if ('erro' in p) throw new Error(p.erro);
      let id: string;
      try {
        id = (await addDoc(collection(abrir(), 'areaClienteChamados'), { ...p.pedido, criadoEm: serverTimestamp() })).id;
      } catch (e) { throw new Error(mensagemDoErro(e), { cause: e }); }
      novos.set(token, [...(novos.get(token) ?? []), { id, tipo: p.pedido.tipo, titulo: p.pedido.titulo ?? '', texto: p.pedido.texto, em: new Date().toISOString() }]);
      avisarToken(token);
      return id;
    },

    async responderChamado(token, id, texto) {
      const chamado = ultimo.get(token)?.chamados.find(c => c.id === id);
      if (!chamado) throw new Error('Este chamado ainda não chegou ao escritório. Espere um pouco e tente de novo.');
      if (!ac.chamadoAceitaResposta(chamado)) throw new Error('Chamado concluído. Para outro assunto, abra um novo.');
      const p = pedidoDeChamado(token, { tipo: chamado.tipo, texto, chamadoId: id });
      if ('erro' in p) throw new Error(p.erro);
      try {
        await addDoc(collection(abrir(), 'areaClienteChamados'), { ...p.pedido, criadoEm: serverTimestamp() });
      } catch (e) { throw new Error(mensagemDoErro(e), { cause: e }); }
      respostas.set(token, [...(respostas.get(token) ?? []), { chamadoId: id, texto: p.pedido.texto, em: new Date().toISOString() }]);
      avisarToken(token);
    },

    async enviar(token, tipo, arquivos) {
      // confere todos antes de mandar o primeiro (um arquivo ruim no meio não deixa metade enviada sem aviso)
      const pedidos = [];
      for (const a of arquivos) {
        const p = pedidoDeEnvio(token, tipo, { nome: a.name, tamanho: a.size }, a.size > ac.MAIOR_ENVIO ? '' : base64DosBytes(new Uint8Array(await a.arrayBuffer())));
        if ('erro' in p) throw new Error(p.erro);
        pedidos.push(p.pedido);
      }
      for (const pedido of pedidos) {
        try {
          await addDoc(collection(abrir(), 'areaClienteEnvios'), { ...pedido, criadoEm: serverTimestamp() });
        } catch (e) { throw new Error(pedido.nome + ': ' + mensagemDoErro(e), { cause: e }); }
      }
    },

    async enviarFotoDoFuncionario() {
      throw new Error('A foto do funcionário ainda não vai pelo site. Mande pelo WhatsApp do escritório.');
    },

    async baixarGuia(token, id) {
      if (!ehTokenDoLink(token) || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) return null;
      try {
        const s = await getDocs(collection(abrir(), 'areasCliente', token, 'guias', id, 'pdf'));
        const pedacos: PedacoDoPdf[] = s.docs.map(d => d.data()).filter(x => typeof x.base64 === 'string' && typeof x.n === 'number' && typeof x.total === 'number')
          .map(x => ({ base64: x.base64 as string, n: x.n as number, total: x.total as number }));
        const arquivo = juntarPedacosDoPdf(pedacos);
        return arquivo ? { nome: nomeDoPdfDaGuia(ultimo.get(token)?.guias.find(g => g.id === id) ?? null), arquivo } : null;
      } catch {
        return null;
      }
    },

    // sem fonte no banco por enquanto (as seções estão escondidas): nada a baixar
    async baixarDocumento() { return null; },
    async baixarComprovante() { return null; },
  };
}
