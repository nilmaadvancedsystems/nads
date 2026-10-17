// O Importador LCDPR no banco do Entregas: o documento lcdpr/config {config, categorias, planoContas, ncmRules, imoveis,
// ieDest, tipoDoc, tipoLanc} — o mesmo que o lcdpr.html lê e grava (inteiro, com set), com os mesmos campos e nada a
// mais (um campo a mais sumiria na próxima gravação de lá). Na regra do Entregas, lê e grava quem é admin ou do Fiscal.
import { lcdpr } from '@nads/core';
import { doc, onSnapshot, setDoc as setDocBruto } from 'firebase/firestore';
import { guardar } from '../../../comum/modoDesenvolvedor';
import { bancoDoEntregas } from './entregas.firestore';
import type { ConfigDoLcdpr, RepoLcdpr } from './lcdpr';

const setDoc = guardar(setDocBruto) as typeof setDocBruto;

const erroDe = (err: Error) => (/permission|insufficient/i.test(err.message) ? 'A regra do banco só deixa o admin e o Fiscal lerem e gravarem o LCDPR.' : err.message);

export function criarLcdprFirestore(): RepoLcdpr {
  const db = bancoDoEntregas();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  let estado: ConfigDoLcdpr = { carregada: false, config: lcdpr.configPadrao(), semDocumento: false, erro: '' };
  let ouvindo = false;
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
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
