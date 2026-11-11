// O Importador LCDPR no banco do Entregas: o documento lcdpr/config {config, categorias, planoContas, ncmRules, imoveis,
// ieDest, tipoDoc, tipoLanc} — o mesmo que o lcdpr.html lê e grava (inteiro, com set), com os mesmos campos e nada a
// mais (um campo a mais sumiria na próxima gravação de lá). Na regra do Entregas, lê e grava quem é admin ou do Fiscal.
// O mês (11/11/2026): lcdprEmpresas/{empresa}/meses/{AAAA-MM}, um documento por competência com os lançamentos; e a conta
// de pagamento lembrada de cada fornecedor em lcdprEmpresas/{empresa} ({ contas }). As mudanças seguidas no mês (classificar
// linha a linha) vão juntas, de segundo em segundo: o disjuntor de gravação para o documento com mais de 400 em 15 min.
import { lcdpr } from '@nads/core';
import { doc, onSnapshot, setDoc as setDocBruto } from 'firebase/firestore';
import { guardar } from '../../../comum/modoDesenvolvedor';
import { bancoDoEntregas } from './entregas.firestore';
import type { CadastrosNoBanco, ConfigDoLcdpr, ContasNoBanco, MesNoBanco, RepoLcdpr } from './lcdpr';

const setDoc = guardar(setDocBruto) as typeof setDocBruto;

const erroDe = (err: Error) => (/permission|insufficient/i.test(err.message) ? 'A regra do banco só deixa o admin e o Fiscal lerem e gravarem o LCDPR.' : err.message);
/** de quanto em quanto tempo a última versão do mês vai para o banco */
const JUNTAR_MS = 1200;

export function criarLcdprFirestore(quem: () => string): RepoLcdpr {
  const db = bancoDoEntregas();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  let estado: ConfigDoLcdpr = { carregada: false, config: lcdpr.configPadrao(), semDocumento: false, erro: '' };
  let ouvindo = false;
  const meses = new Map<string, { estado: MesNoBanco; pendente: lcdpr.MesDoLcdpr | null; relogio: ReturnType<typeof setTimeout> | null }>();
  const contas = new Map<number, ContasNoBanco>();
  const cadastros = new Map<number, CadastrosNoBanco>();
  return {
    exemplos: false,
    config() {
      if (!ouvindo) {
        ouvindo = true;
        onSnapshot(doc(db, 'lcdpr', 'config'), s => {
          estado = { carregada: true, config: lcdpr.configDoDocumento(s.data()), semDocumento: !s.exists(), erro: '' };
          mudou();
        }, err => { estado = { ...estado, carregada: true, erro: erroDe(err) }; mudou(); });
      }
      return estado;
    },
    async salvar(c) {
      try {
        await setDoc(doc(db, 'lcdpr', 'config'), lcdpr.documentoDaConfig(c));
      } catch (e) {
        throw new Error(erroDe(e as Error), { cause: e });
      }
    },
    mes(empresa, competencia) {
      const k = empresa + '_' + competencia;
      const ja = meses.get(k);
      if (ja) return ja.pendente ? { ...ja.estado, mes: ja.pendente, salvando: true } : ja.estado;
      const m: { estado: MesNoBanco; pendente: lcdpr.MesDoLcdpr | null; relogio: ReturnType<typeof setTimeout> | null } = {
        estado: { carregado: false, mes: lcdpr.mesVazio(empresa, competencia), salvando: false, erro: '' }, pendente: null, relogio: null,
      };
      meses.set(k, m);
      onSnapshot(doc(db, 'lcdprEmpresas', String(empresa), 'meses', competencia), s => {
        m.estado = { carregado: true, mes: lcdpr.mesDoDocumento(s.data(), empresa, competencia), salvando: false, erro: '' };
        mudou();
      }, err => { m.estado = { ...m.estado, carregado: true, erro: erroDe(err) }; mudou(); });
      return m.estado;
    },
    salvarMes(novo, aoFalhar) {
      const k = novo.empresa + '_' + novo.competencia;
      const m = meses.get(k);
      if (!m) return;
      m.pendente = { ...novo, atualizadoEm: new Date().toISOString(), atualizadoPor: quem().slice(0, 100) };
      mudou();
      if (m.relogio) return;
      m.relogio = setTimeout(() => {
        m.relogio = null;
        const vai = m.pendente;
        if (!vai) return;
        setDoc(doc(db, 'lcdprEmpresas', String(vai.empresa), 'meses', vai.competencia), lcdpr.documentoDoMes(vai))
          .then(() => { if (m.pendente === vai) { m.pendente = null; m.estado = { ...m.estado, mes: vai }; mudou(); } })
          .catch((e: Error) => { if (m.pendente === vai) m.pendente = null; mudou(); aoFalhar(erroDe(e)); });
      }, JUNTAR_MS);
    },
    contas(empresa) {
      const ja = contas.get(empresa);
      if (ja) return ja;
      const c: ContasNoBanco = { carregadas: false, contas: {} };
      contas.set(empresa, c);
      onSnapshot(doc(db, 'lcdprEmpresas', String(empresa)), s => { contas.set(empresa, { carregadas: true, contas: lcdpr.contasDoDocumento(s.data()) }); mudou(); },
        () => { contas.set(empresa, { carregadas: true, contas: {} }); mudou(); });
      return c;
    },
    async salvarContas(empresa, novas) {
      contas.set(empresa, { carregadas: true, contas: novas });
      mudou();
      try {
        await setDoc(doc(db, 'lcdprEmpresas', String(empresa)), { contas: { ...novas }, atualizadoEm: new Date().toISOString(), atualizadoPor: quem().slice(0, 100) });
      } catch (e) {
        throw new Error(erroDe(e as Error), { cause: e });
      }
    },
    cadastros(empresa) {
      const ja = cadastros.get(empresa);
      if (ja) return ja;
      const c: CadastrosNoBanco = { carregados: false, cadastros: lcdpr.cadastrosVazios() };
      cadastros.set(empresa, c);
      onSnapshot(doc(db, 'lcdprEmpresas', String(empresa), 'cadastros', 'alterdata'),
        s => { cadastros.set(empresa, { carregados: true, cadastros: lcdpr.cadastrosDoDocumento(s.data()) }); mudou(); },
        () => { cadastros.set(empresa, { carregados: true, cadastros: lcdpr.cadastrosVazios() }); mudou(); });
      return c;
    },
    async salvarCadastros(empresa, c) {
      try {
        await setDoc(doc(db, 'lcdprEmpresas', String(empresa), 'cadastros', 'alterdata'), { ...JSON.parse(JSON.stringify(c)), por: quem().slice(0, 100) });
      } catch (e) {
        throw new Error(erroDe(e as Error), { cause: e });
      }
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
