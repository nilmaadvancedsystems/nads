// O lote de guias do Fiscal › Relatório › Enviar guias no banco do Entregas (03/11/2026), nas regras de lá (só o Fiscal e o
// admin), no desenho do lote do DP (loteDp.firestore.ts), numa coleção própria:
//   - lotesFiscal/{lote}: { status: 'enviando' → 'pendente' (a tela) → lendo → lido (o robô) → 'disparar' (a tela, com
//     disparadoPor/disparadoPorUid) → disparando → disparado (o robô), grupo: 'sn'|'lp', criadoEm, criadoPor, criadoPorUid,
//     total, lidos, resultados.<código>_<AAAA-MM> (com valores por coluna, preenchidos e erroNoRelatorio) };
//   - lotesFiscal/{lote}/arquivos/{k}: { nome, tamanho, partes, status }, com os pedaços em .../partes/{n} { dados: Bytes };
//     o robô grava a leitura (com a coluna do Relatório) ou o erro; a tela, a escolha (com a coluna) e o fora;
//   - solicitacoesEmail { tipo: 'envioFiscal' }: o registro de cada e-mail que o robô mandou (a aba "Enviados"; fica, o lote some em 3 dias),
//     e das guias impressas (via: 'impresso', com o entregaId da entrega que o robô pôs na rota do Entregas; 04/11/2026);
//   - lotesFiscal/{lote}.vias: { <código>: 'email'|'impresso' }, a via de cada cliente, gravada pela tela antes do disparo;
//   - config/envioFiscal: o modelo do e-mail { assunto, texto, atualizadoEm, atualizadoPor } (o Fiscal e o admin gravam);
//   - fiscalArquivos/{AAAA-MM}: as guias do Fiscal já arquivadas no Drive, por cliente (o robô grava, a tela lê); o lote
//     criado delas tem os arquivos { nome, tamanho, driveId, origem: { codigo, competencia, pasta }, status: 'pendente' },
//     sem os pedaços: o robô lê pelo Drive (plano do Acessórias, 17/11/2026, ficha E15; frase do dono: "Seguir"). Precisa da regra do Vitor
//     (docs/acessorias/regra-lote-da-pasta.md).
import { addDoc as addDocBruto, Bytes, collection, deleteField, doc, getDocs, onSnapshot, query, setDoc as setDocBruto, updateDoc as updateDocBruto, where } from 'firebase/firestore';
import { entregas as e } from '@nads/core';
import { guardar, guardarPedido } from '../../../comum/modoDesenvolvedor';
import { bancoDoEntregas } from './entregas.firestore';
import type { ModeloDoEnvio } from './enviosDp';
import { arquivoDoBanco, loteDoBanco } from './loteDp.firestore';
import { guiasDoDocumento, viaDaGuia, type EnvioDasGuias, type GuiaDoLote, type LoteFiscal, type RepoLoteFiscal, type ResultadoDoLoteFiscal } from './loteFiscal';

// a trava do modo desenvolvedor (comum/modoDesenvolvedor.ts): com o modo ligado, só ver — nada é gravado
const addDoc = guardarPedido(addDocBruto) as typeof addDocBruto;
const setDoc = guardar(setDocBruto) as typeof setDocBruto;
const updateDoc = guardar(updateDocBruto) as typeof updateDocBruto;
const texto = (v: unknown) => (v == null ? '' : String(v));
const textos = (v: unknown) => (Array.isArray(v) ? v.map(texto) : []);

function guiaDoBanco(id: string, d: Record<string, unknown>): GuiaDoLote {
  const a = arquivoDoBanco(id, d);
  const l = (d.leitura || {}) as Record<string, unknown>;
  const es = (d.escolha || {}) as Record<string, unknown>;
  return {
    ...a,
    leitura: a.leitura ? {
      ...a.leitura, coluna: texto(l.coluna),
      partes: (Array.isArray(l.partes) ? l.partes : []).map((p: Record<string, unknown>) => ({ tributo: texto(p?.tributo), coluna: texto(p?.coluna), valor: texto(p?.valor) })),
    } : null,
    escolha: a.escolha ? { ...a.escolha, ...(typeof es.coluna === 'string' ? { coluna: es.coluna } : {}) } : null,
  };
}
/** o resultado da publicação no SCI Report (24/11/2026, robo/sci.js); sem ele, nada */
function sciReportDoBanco(v: unknown): { sciReport?: ResultadoDoLoteFiscal['sciReport'] } {
  if (!v || typeof v !== 'object') return {};
  const o = v as Record<string, unknown>;
  const falhas = Array.isArray(o.falhas) ? o.falhas.flatMap(f => (f && typeof f === 'object' ? [{ nome: texto((f as Record<string, unknown>).nome), erro: texto((f as Record<string, unknown>).erro) }] : [])) : [];
  return { sciReport: { publicadas: Number(o.publicadas) || 0, falhas, erro: texto(o.erro) } };
}
function loteFiscalDoBanco(id: string, d: Record<string, unknown>): LoteFiscal {
  const l = loteDoBanco(id, d);
  const r = (d.resultados || {}) as Record<string, Record<string, unknown>>;
  return {
    ...l, grupo: d.grupo === 'lp' ? 'lp' : 'sn',
    resultados: l.resultados.map(x => ({
      ...x, preenchidos: textos(r[x.chave]?.preenchidos), erroNoRelatorio: texto(r[x.chave]?.erroNoRelatorio),
      via: viaDaGuia(r[x.chave]?.via), entregaId: texto(r[x.chave]?.entregaId), jaNaRota: textos(r[x.chave]?.jaNaRota),
      ...sciReportDoBanco(r[x.chave]?.sciReport),
    })),
    vias: Object.fromEntries(Object.entries((d.vias || {}) as Record<string, unknown>).map(([k, v]) => [k, viaDaGuia(v)] as const)),
  };
}

export function criarLoteFiscalFirestore(quem: () => e.Quem | null): RepoLoteFiscal {
  const db = bancoDoEntregas();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  let lotes: { carregados: boolean; lista: LoteFiscal[] } = { carregados: false, lista: [] };
  let ouvindo = '';
  let modelo: { carregado: boolean } & ModeloDoEnvio = { carregado: false, assunto: '', texto: '' };
  let ouvindoModelo = false;
  const enviadosDoMes = new Map<string, { carregados: boolean; lista: EnvioDasGuias[] }>();

  return {
    exemplos: false,
    lotes() {
      const q = quem();
      if (q && ouvindo !== q.uid) {
        ouvindo = q.uid;
        // só igualdade (sem orderBy, que pediria um índice): a ordem é feita aqui
        onSnapshot(query(collection(db, 'lotesFiscal'), where('criadoPorUid', '==', q.uid)), s => {
          // o excluído ('cancelado') some na hora; o robô apaga do banco logo depois
          lotes = { carregados: true, lista: s.docs.filter(x => x.get('status') !== 'cancelado').map(x => loteFiscalDoBanco(x.id, x.data())).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)) };
          mudou();
        }, () => { lotes = { carregados: true, lista: [] }; mudou(); });
      }
      return lotes;
    },
    arquivos(lote, chegou) {
      return onSnapshot(collection(db, 'lotesFiscal', lote, 'arquivos'), s => {
        chegou(s.docs.map(x => guiaDoBanco(x.id, x.data())).sort((a, b) => Number(a.id) - Number(b.id)));
      }, () => chegou([]));
    },
    guiasNaPasta(competencia, chegou) {
      // um documento por mês (como o dpArquivos do DP); a regra nova ainda não publicada dá permissão negada
      return onSnapshot(doc(db, 'fiscalArquivos', competencia),
        s => chegou({ carregadas: true, erro: '', guias: guiasDoDocumento(competencia, s.exists() ? s.data() : null) }),
        e => chegou({ carregadas: true, erro: /permission/i.test(String(e)) ? 'O banco ainda não deixa ler as guias da pasta (falta a regra do Vitor).' : 'Não consegui ler as guias da pasta.', guias: [] }));
    },
    async criarDaPasta(grupo, guias) {
      const q = quem();
      if (!q) throw new Error('Sem login.');
      const ref = await addDoc(collection(db, 'lotesFiscal'), { status: 'enviando', grupo, criadoEm: new Date().toISOString(), criadoPor: q.nome, criadoPorUid: q.uid, total: guias.length });
      for (let k = 0; k < guias.length; k++) {
        const g = guias[k];
        await setDoc(doc(ref, 'arquivos', String(k)), { nome: g.nome, tamanho: g.tamanho, driveId: g.driveId, origem: { codigo: g.codigo, competencia: g.competencia, pasta: g.pasta }, status: 'pendente' });
      }
      await updateDoc(ref, { status: 'pendente' });
      return ref.id;
    },
    async subir(grupo, lista, andamento) {
      const q = quem();
      if (!q) throw new Error('Sem login.');
      const ref = await addDoc(collection(db, 'lotesFiscal'), { status: 'enviando', grupo, criadoEm: new Date().toISOString(), criadoPor: q.nome, criadoPorUid: q.uid, total: lista.length });
      for (let k = 0; k < lista.length; k++) {
        const a = lista[k];
        const partes = e.partesDoArquivo(a.bytes);
        const arq = doc(ref, 'arquivos', String(k));
        await setDoc(arq, { nome: e.nomeParaEnviar(a.nome), tamanho: a.bytes.length, partes: partes.length, status: 'enviando' });
        for (let i = 0; i < partes.length; i++) await setDoc(doc(arq, 'partes', String(i)), { dados: Bytes.fromUint8Array(partes[i]) });
        await updateDoc(arq, { status: 'pendente' });
        andamento(k + 1, lista.length);
      }
      await updateDoc(ref, { status: 'pendente' });
      return ref.id;
    },
    async adicionar(lote, lista, andamento) {
      if (!quem()) throw new Error('Sem login.');
      const ref = doc(db, 'lotesFiscal', lote);
      // as novas continuam a numeração; o lote volta a "enviando" (a regra só deixa do lido, aumentando o total)
      const antes = await getDocs(collection(ref, 'arquivos'));
      const inicio = antes.docs.reduce((n, x) => Math.max(n, Number(x.id) + 1), 0);
      await updateDoc(ref, { status: 'enviando', total: antes.size + lista.length });
      for (let k = 0; k < lista.length; k++) {
        const a = lista[k];
        const partes = e.partesDoArquivo(a.bytes);
        const arq = doc(ref, 'arquivos', String(inicio + k));
        await setDoc(arq, { nome: e.nomeParaEnviar(a.nome), tamanho: a.bytes.length, partes: partes.length, status: 'enviando' });
        for (let i = 0; i < partes.length; i++) await setDoc(doc(arq, 'partes', String(i)), { dados: Bytes.fromUint8Array(partes[i]) });
        await updateDoc(arq, { status: 'pendente' });
        andamento(k + 1, lista.length);
      }
      await updateDoc(ref, { status: 'pendente' });
      return lista.map((_, k) => String(inicio + k));
    },
    async escolher(lote, arquivo, escolha) {
      // sem a coluna, o campo não vai (o Firestore não aceita undefined): vale a do leitor
      await updateDoc(doc(db, 'lotesFiscal', lote, 'arquivos', arquivo), {
        escolha: escolha ? { cliente: escolha.cliente, tipo: escolha.tipo, competencia: escolha.competencia, ...(typeof escolha.coluna === 'string' ? { coluna: escolha.coluna } : {}) } : null,
      });
    },
    async tirar(lote, arquivo, fora) {
      await updateDoc(doc(db, 'lotesFiscal', lote, 'arquivos', arquivo), { fora });
    },
    async bytesDaGuia(lote, arquivo) {
      // os pedaços na ordem (o id é o número); a regra deixa só o Fiscal e o admin lerem
      const s = await getDocs(collection(db, 'lotesFiscal', lote, 'arquivos', arquivo, 'partes'));
      if (!s.docs.length) throw new Error('a guia não está mais no lote (o robô apaga depois do envio)');
      const pedacos = s.docs.sort((a, b) => Number(a.id) - Number(b.id)).map(x => (x.data().dados as Bytes).toUint8Array());
      const tudo = new Uint8Array(pedacos.reduce((n, p) => n + p.length, 0));
      let i = 0;
      for (const p of pedacos) { tudo.set(p, i); i += p.length; }
      return tudo;
    },
    async excluir(lote) {
      const q = quem();
      if (!q) throw new Error('Sem login.');
      await updateDoc(doc(db, 'lotesFiscal', lote), { status: 'cancelado', canceladoPor: q.nome, canceladoPorUid: q.uid, canceladoEm: new Date().toISOString() });
    },
    async definirVias(lote, vias) {
      // a regra deixa mudar só as vias, com o lote parado (lido ou disparado)
      await updateDoc(doc(db, 'lotesFiscal', lote), { vias });
    },
    async disparar(lote, agendadoPara) {
      const q = quem();
      if (!q) throw new Error('Sem login.');
      // o envio agendado (plano do Acessórias, 17/11/2026, ficha E17): o robô só dispara depois de agendadoPara (precisa da regra do Vitor:
      // docs/acessorias/regra-envio-agendado.md); sem ele, o pedido é o de sempre
      await updateDoc(doc(db, 'lotesFiscal', lote), { status: 'disparar', disparadoPor: q.nome, disparadoPorUid: q.uid, pedidoEm: new Date().toISOString(), ...(agendadoPara ? { agendadoPara } : {}) });
    },
    async cancelarAgendamento(lote) {
      await updateDoc(doc(db, 'lotesFiscal', lote), { status: 'lido', agendadoPara: deleteField() });
    },
    enviados(competencia) {
      if (!enviadosDoMes.has(competencia)) {
        enviadosDoMes.set(competencia, { carregados: false, lista: [] });
        // só igualdade (sem orderBy, que pediria um índice): a ordem é feita aqui
        onSnapshot(query(collection(db, 'solicitacoesEmail'), where('tipo', '==', 'envioFiscal'), where('competencia', '==', competencia)), s => {
          const lista = s.docs.map(x => {
            const d = x.data();
            return {
              id: x.id, codigo: Number(d.codigo) || 0, empresa: texto(d.empresa), competencia: texto(d.competencia), grupo: d.grupo === 'lp' ? 'lp' : 'sn',
              para: textos(d.para), guias: textos(d.enviados),
              guiasDrive: (Array.isArray(d.guiasDrive) ? d.guiasDrive : []).map((g: Record<string, unknown>) => ({ nome: texto(g?.nome), id: texto(g?.id) })).filter((g: { id: string }) => g.id), enviadoEm: texto(d.enviadoEm || d.criadoEm), por: texto(d.criadoPor),
              via: viaDaGuia(d.via),
            } satisfies EnvioDasGuias;
          }).sort((a, b) => b.enviadoEm.localeCompare(a.enviadoEm));
          enviadosDoMes.set(competencia, { carregados: true, lista });
          mudou();
        }, () => { enviadosDoMes.set(competencia, { carregados: true, lista: [] }); mudou(); });
      }
      return enviadosDoMes.get(competencia)!;
    },
    modelo() {
      if (!ouvindoModelo) {
        ouvindoModelo = true;
        onSnapshot(doc(db, 'config', 'envioFiscal'), s => {
          const d = s.data() || {};
          modelo = { carregado: true, assunto: texto(d.assunto), texto: texto(d.texto) };
          mudou();
        }, () => { modelo = { carregado: true, assunto: '', texto: '' }; mudou(); });
      }
      return modelo;
    },
    async gravarModelo(m) {
      const q = quem();
      if (!q) throw new Error('Sem login.');
      await setDoc(doc(db, 'config', 'envioFiscal'), { assunto: m.assunto.trim().slice(0, 200), texto: m.texto.trim().slice(0, 5000), atualizadoEm: new Date().toISOString(), atualizadoPor: q.nome });
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
