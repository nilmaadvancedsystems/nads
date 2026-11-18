// O Lançatudo no banco: o MESMO Firestore do Extrator e do Creditor (projeto conferencia-nilma, regras abertas; nenhuma
// regra foi mudada), debaixo da empresa no Extrator:
//   extrator/{slug(nome)}/lancatudo/config     → { regras, lembradas } (vale em todo mês)
//   extrator/{slug(nome)}/lancatudo/{aaaa-mm}  → { competencia, decisoes, exportacoes }
// Carrega só a empresa e o mês abertos (dois documentos ouvidos); grava o documento inteiro, com quem e quando. A tela já
// mostra a mudança na hora (o estado local vai antes da resposta do banco). No modo desenvolvedor, a gravação é fingida.
import { formatos, lancatudo } from '@nads/core';
import { doc, onSnapshot, setDoc as setDocBruto } from 'firebase/firestore';
import { guardar } from '../../../comum/modoDesenvolvedor';
import { bancoDaConferencia } from './extrator.firestore';
import type { ConfigNoBanco, MesNoBanco, RepoLancatudo } from './lancatudo';

const setDoc = guardar(setDocBruto) as typeof setDocBruto;

const erroDe = (e: Error) => 'Não deu para salvar no banco: ' + e.message;

export function criarLancatudoFirestore(quem: () => string): RepoLancatudo {
  const db = bancoDaConferencia();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  const configs = new Map<string, ConfigNoBanco>();
  const meses = new Map<string, MesNoBanco>();
  const ref = (empresa: string, id: string) => doc(db, 'extrator', formatos.slug(empresa), 'lancatudo', id);
  return {
    exemplos: false,
    config(empresa) {
      const ja = configs.get(empresa);
      if (ja) return ja;
      const c: ConfigNoBanco = { carregada: false, config: lancatudo.configVazia(), erro: '' };
      configs.set(empresa, c);
      onSnapshot(ref(empresa, 'config'), s => { configs.set(empresa, { carregada: true, config: lancatudo.configDoDocumento(s.data()), erro: '' }); mudou(); },
        e => { configs.set(empresa, { ...configs.get(empresa)!, carregada: true, erro: e.message }); mudou(); });
      return c;
    },
    async salvarConfig(empresa, c) {
      const antes = configs.get(empresa);
      if (!antes?.carregada) throw new Error('as regras da empresa ainda não chegaram do banco');
      configs.set(empresa, { ...antes, config: c });
      mudou();
      try {
        await setDoc(ref(empresa, 'config'), { ...lancatudo.documentoDaConfig(c), atualizadoEm: new Date().toISOString(), atualizadoPor: quem().slice(0, 100) });
      } catch (e) {
        configs.set(empresa, antes);
        mudou();
        throw new Error(erroDe(e as Error), { cause: e });
      }
    },
    mes(empresa, competencia) {
      const k = empresa + '|' + competencia;
      const ja = meses.get(k);
      if (ja) return ja;
      const m: MesNoBanco = { carregado: false, mes: lancatudo.mesVazio(competencia), erro: '' };
      meses.set(k, m);
      onSnapshot(ref(empresa, competencia), s => { meses.set(k, { carregado: true, mes: lancatudo.mesDoDocumento(s.data(), competencia), erro: '' }); mudou(); },
        e => { meses.set(k, { ...meses.get(k)!, carregado: true, erro: e.message }); mudou(); });
      return m;
    },
    async salvarMes(empresa, m) {
      const k = empresa + '|' + m.competencia;
      const antes = meses.get(k);
      if (!antes?.carregado) throw new Error('o mês ainda não chegou do banco');
      meses.set(k, { ...antes, mes: m });
      mudou();
      try {
        await setDoc(ref(empresa, m.competencia), { ...lancatudo.documentoDoMes(m), atualizadoEm: new Date().toISOString(), atualizadoPor: quem().slice(0, 100) });
      } catch (e) {
        meses.set(k, antes);
        mudou();
        throw new Error(erroDe(e as Error), { cause: e });
      }
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
