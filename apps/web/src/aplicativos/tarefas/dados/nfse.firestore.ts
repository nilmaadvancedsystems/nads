// O emissor de NFS-e no banco do Entregas (15/10/2026), nas regras de lá (o admin e o diretor):
//   - nfseEmissoes: o pedido {status: 'pedida', ambiente, tomador, servico, empresaCodigo, pedidoPor, pedidoPorUid, pedidoEm};
//     o robô escreve o andamento (dps, chaveAcesso, numeroNfse, xmlNfse, erros); o nads só volta uma recusada para a
//     fila (com as correções) e pede o cancelamento;
//   - config/nfse: o prestador, o serviço e a numeração (o admin grava; o robô só aumenta o número);
//   - nfseEmissoes/{id}.envioEmail {para, pedidoPor, pedidoEm}: o pedido de mandar a autorizada por e-mail (o robô manda,
//     grava email {para, enviadoEm, erro} e apaga o pedido); config/nfse.email {automatico, assunto, texto}: o envio automático;
//   - config/nfse.descricao: o modelo da descrição automática das notas ({competencia}, {mes}, {ano});
//   - segredos/nfse: o token da prefeitura (o admin grava e não lê; só o robô lê);
//   - robo/nfse (só leitura): o robô ligado (com o certificado do escritório) ou o motivo.
import { nfse } from '@nads/core';
import { addDoc, collection, doc, getDoc, limit, onSnapshot, orderBy, query, setDoc as setDocBruto, updateDoc as updateDocBruto } from 'firebase/firestore';
import { guardar } from '../../../comum/modoDesenvolvedor';
import type { ListaAoVivo } from './agentes';
import { bancoDoEntregas } from './entregas.firestore';
import type { ConfigCarregada, RepoNfse, RoboNfse } from './nfse';

const updateDoc = guardar(updateDocBruto) as typeof updateDocBruto;
const setDoc = guardar(setDocBruto) as typeof setDocBruto;
type Quem = { nome: string; uid: string } | null;
const texto = (v: unknown) => (v == null ? '' : String(v));
const obj = (v: unknown) => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});
const STATUS: nfse.StatusNfse[] = ['pedida', 'enviando', 'processando', 'autorizada', 'erro', 'cancelamento-pedido', 'cancelada', 'erro-cancelamento'];

function notaDoBanco(id: string, d: Record<string, unknown>): nfse.NotaFiscal {
  const t = obj(d.tomador), s = obj(d.servico), dps = d.dps ? obj(d.dps) : null, c = d.cancelamento ? obj(d.cancelamento) : null;
  return {
    id, status: (STATUS.includes(d.status as nfse.StatusNfse) ? d.status : 'pedida') as nfse.StatusNfse,
    ambiente: d.ambiente === 'producao' ? 'producao' : 'homologacao',
    tomador: { documento: texto(t.documento), nome: texto(t.nome), email: texto(t.email) || undefined, fone: texto(t.fone) || undefined, endereco: t.endereco ? enderecoDoBanco(obj(t.endereco)) : undefined },
    servico: { descricao: texto(s.descricao), valor: Number(s.valor) || 0, competencia: texto(s.competencia) },
    empresaCodigo: typeof d.empresaCodigo === 'number' ? d.empresaCodigo : null,
    pedidoPor: texto(d.pedidoPor), pedidoEm: texto(d.pedidoEm),
    dps: dps ? { serie: texto(dps.serie), numero: Number(dps.numero) || 0, id: texto(dps.id) } : null,
    chaveAcesso: texto(d.chaveAcesso), numeroNfse: texto(d.numeroNfse),
    erros: Array.isArray(d.erros) ? (d.erros as Record<string, unknown>[]).map(e => ({ codigo: texto(e.codigo), descricao: texto(e.descricao) })) : [],
    atualizadoEm: texto(d.atualizadoEm), enviadaEm: texto(d.enviadaEm), consultas: Number(d.consultas) || 0, autorizadaEm: texto(d.autorizadaEm),
    cancelamento: c ? { cMotivo: texto(c.cMotivo), motivo: texto(c.motivo), pedidoPor: texto(c.pedidoPor), pedidoEm: texto(c.pedidoEm) } : null,
    email: d.email ? emailDoBanco(obj(d.email)) : null,
    envioEmail: d.envioEmail ? { para: texto(obj(d.envioEmail).para), pedidoPor: texto(obj(d.envioEmail).pedidoPor), pedidoEm: texto(obj(d.envioEmail).pedidoEm) } : null,
  };
}

function emailDoBanco(e: Record<string, unknown>): nfse.EmailDaNota {
  return { para: texto(e.para), enviadoEm: texto(e.enviadoEm), erro: texto(e.erro) };
}

function enderecoDoBanco(e: Record<string, unknown>) {
  return { cMun: texto(e.cMun), cep: texto(e.cep), logradouro: texto(e.logradouro), numero: texto(e.numero), bairro: texto(e.bairro) };
}

/** o tomador como vai para o banco: só os dígitos no documento, no telefone e no CEP; sem os campos vazios */
function tomadorParaOBanco(t: nfse.TomadorNfse) {
  const e = t.endereco;
  return {
    documento: nfse.soDigitos(t.documento), nome: t.nome.trim(),
    ...(t.email ? { email: t.email.trim() } : {}),
    ...(t.fone ? { fone: nfse.soDigitos(t.fone) } : {}),
    ...(e ? { endereco: { cMun: e.cMun, cep: nfse.soDigitos(e.cep), logradouro: e.logradouro.trim(), numero: e.numero.trim(), bairro: e.bairro.trim() } } : {}),
  };
}

function configDoBanco(d: Record<string, unknown>): nfse.ConfigNfse {
  const p = obj(d.prestador), s = obj(d.servico), n = obj(d.proximoNumero), P = nfse.CONFIG_PADRAO;
  const op = Number(p.opSimpNac);
  const ap = Number(p.regApTribSN);
  return {
    ambiente: d.ambiente === 'producao' ? 'producao' : 'homologacao',
    prestador: {
      cnpj: texto(p.cnpj), im: texto(p.im), fone: texto(p.fone),
      opSimpNac: (op === 1 || op === 2 || op === 3 ? op : P.prestador.opSimpNac) as 1 | 2 | 3,
      regApTribSN: (ap === 1 || ap === 2 || ap === 3 ? ap : null) as 1 | 2 | 3 | null,
      regEspTrib: Number(p.regEspTrib) || 0, cLocEmi: texto(p.cLocEmi) || P.prestador.cLocEmi,
    },
    servico: { cTribNac: texto(s.cTribNac) || P.servico.cTribNac, cIntContrib: texto(s.cIntContrib), cNBS: texto(s.cNBS), pAliq: s.pAliq == null || s.pAliq === '' ? null : Number(s.pAliq), infoCompl: s.infoCompl == null ? P.servico.infoCompl : texto(s.infoCompl) },
    serie: texto(d.serie) || P.serie,
    proximoNumero: { homologacao: Number(n.homologacao) || 1, producao: Number(n.producao) || 1 },
    email: nfse.configDoEmail(d.email),
    descricao: nfse.modeloDaDescricao(d.descricao),
  };
}

const erroDe = (err: Error) => (/permission|insufficient/i.test(err.message) ? 'Só o admin e o diretor veem as notas fiscais.' : err.message);

export function criarNfseFirestore(quem: () => Quem): RepoNfse {
  const db = bancoDoEntregas();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  let robo: RoboNfse = { carregado: false, ligado: false, motivo: '', certificado: null };
  let notas: ListaAoVivo<nfse.NotaFiscal> | null = null;
  let config: ConfigCarregada | null = null;
  let ouvindoRobo = false;

  return {
    exemplos: false,
    robo() {
      if (!ouvindoRobo) {
        ouvindoRobo = true;
        onSnapshot(doc(db, 'robo', 'nfse'), s => {
          const d = s.data() || {};
          const c = d.certificado as Record<string, unknown> | null | undefined;
          robo = { carregado: true, ligado: !!d.ligado, motivo: s.exists() ? texto(d.motivo) : 'o robô ainda não ligou o emissor de notas', certificado: c ? { titular: texto(c.titular), validade: texto(c.validade) } : null };
          mudou();
        }, () => { robo = { carregado: true, ligado: false, motivo: 'sem acesso', certificado: null }; mudou(); });
      }
      return robo;
    },
    notas() {
      if (!notas) {
        notas = { carregada: false, lista: [], erro: '' };
        onSnapshot(query(collection(db, 'nfseEmissoes'), orderBy('pedidoEm', 'desc'), limit(300)), s => {
          notas = { carregada: true, lista: s.docs.map(x => notaDoBanco(x.id, x.data())), erro: '' };
          mudou();
        }, err => { notas = { carregada: true, lista: [], erro: erroDe(err) }; mudou(); });
      }
      return notas;
    },
    config() {
      if (!config) {
        config = { carregada: false, config: null, tokenGravadoEm: '' };
        onSnapshot(doc(db, 'config', 'nfse'), s => {
          const d = s.data();
          config = { carregada: true, config: d ? configDoBanco(d) : null, tokenGravadoEm: texto(d?.tokenGravadoEm) };
          mudou();
        }, () => { config = { carregada: true, config: null, tokenGravadoEm: '' }; mudou(); });
      }
      return config;
    },
    async pedir(p, nome) {
      const q = quem();
      if (!q) throw new Error('Sem login.');
      const amb = config?.config?.ambiente || 'homologacao';
      const r = await addDoc(collection(db, 'nfseEmissoes'), {
        status: 'pedida', ambiente: amb,
        tomador: tomadorParaOBanco(p.tomador),
        servico: { descricao: p.servico.descricao.trim(), valor: Math.round(p.servico.valor * 100) / 100, competencia: p.servico.competencia },
        empresaCodigo: p.empresaCodigo, pedidoPor: nome || q.nome, pedidoPorUid: q.uid, pedidoEm: new Date().toISOString(),
      });
      return r.id;
    },
    async reenviar(id, p) {
      await updateDoc(doc(db, 'nfseEmissoes', id), {
        status: 'pedida', erros: [], atualizadoEm: new Date().toISOString(),
        tomador: tomadorParaOBanco(p.tomador),
        servico: { descricao: p.servico.descricao.trim(), valor: Math.round(p.servico.valor * 100) / 100, competencia: p.servico.competencia },
      });
    },
    async cancelar(id, cMotivo, motivo, nome) {
      await updateDoc(doc(db, 'nfseEmissoes', id), { status: 'cancelamento-pedido', cancelamento: { cMotivo, motivo: motivo.trim(), pedidoPor: nome, pedidoEm: new Date().toISOString() } });
    },
    async enviarPorEmail(id, para, nome) {
      await updateDoc(doc(db, 'nfseEmissoes', id), { envioEmail: { para: para.trim(), pedidoPor: nome, pedidoEm: new Date().toISOString() } });
    },
    async salvarConfig(c) {
      await setDoc(doc(db, 'config', 'nfse'), { ambiente: c.ambiente, prestador: { ...c.prestador, cnpj: nfse.soDigitos(c.prestador.cnpj), fone: nfse.soDigitos(c.prestador.fone) }, servico: { ...c.servico, cNBS: nfse.soDigitos(c.servico.cNBS) }, serie: c.serie, proximoNumero: c.proximoNumero, email: { automatico: c.email.automatico, assunto: c.email.assunto.trim(), texto: c.email.texto.trim() }, descricao: c.descricao.trim() }, { merge: true });
    },
    async salvarToken(token, nome) {
      const agora = new Date().toISOString();
      await setDoc(doc(db, 'segredos', 'nfse'), { token: token.trim(), gravadoEm: agora, gravadoPor: nome });
      await setDoc(doc(db, 'config', 'nfse'), { tokenGravadoEm: agora }, { merge: true });
    },
    async xml(id) {
      const s = await getDoc(doc(db, 'nfseEmissoes', id));
      return texto(s.data()?.xmlNfse);
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
