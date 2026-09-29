// Repositório do Creditor no banco: o MESMO Firestore da Conferência (projeto conferencia-nilma).
//   empresas/{slug(nome)}                   → SÓ LEITURA: o documento da Conferência, de onde saem o
//                                              balancete (`contas`) ou, se ele foi apagado ao sair, o
//                                              plano (`balanceteAssinatura`). O Creditor nunca grava aqui.
//   extrator/{slug(nome)}/creditor/contas   → as contas e históricos que a pessoa confirmou ou trocou
//                                              { contas, nomes, atualizadoEm }
// Os dois ficam ouvidos (onSnapshot): balancete importado de novo na Conferência chega na hora.
// Cuidados, os mesmos da Conferência: carrega só a empresa aberta; nada é gravado antes de as duas
// leituras chegarem; grava só o que mudou; se falhar, avisa 'Não deu para salvar "…" na nuvem: …'.
import { creditor as cr, formatos } from '@nads/core';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { bancoDaConferencia } from './extrator.firestore';

type Aviso = (mensagem: string) => void;

export interface RepoCreditorFirestore extends cr.RepoCreditor {
  /** Quem mostra os avisos de erro (o toast da tela). */
  definirAviso(fn: Aviso): void;
}

interface Carga {
  balancete: cr.BalanceteDaEmpresa;
  balanceteChegou: boolean;
  config: cr.ConfigCreditor;
  configChegou: boolean;
}

export function criarRepoCreditorFirestore(): RepoCreditorFirestore {
  const db = bancoDaConferencia();
  const cargas = new Map<string, Carga>();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  let avisar: Aviso = m => console.warn(m);
  const avisarTodos = () => { ver++; for (const f of ouvintes) f(); };

  /** Começa a ouvir a empresa no banco (uma vez só por empresa). */
  function carregar(nome: string): Carga {
    const pronta = cargas.get(nome);
    if (pronta) return pronta;
    const c: Carga = { balancete: cr.SEM_BALANCETE, balanceteChegou: false, config: cr.CONFIG_VAZIA, configChegou: false };
    cargas.set(nome, c);
    const id = formatos.slug(nome);
    const falhou = (err: Error) => avisar('Não consegui ler "' + nome + '" na nuvem: ' + err.message);
    onSnapshot(doc(db, 'empresas', id), s => {
      c.balancete = cr.balanceteDoDocumento(s.exists() ? s.data() : null);
      c.balanceteChegou = true;
      avisarTodos();
    }, falhou);
    onSnapshot(doc(db, 'extrator', id, 'creditor', 'contas'), s => {
      c.config = cr.configDoDocumento(s.exists() ? s.data() : null);
      c.configChegou = true;
      avisarTodos();
    }, falhou);
    return c;
  }

  const carregada = (c: Carga) => c.balanceteChegou && c.configChegou;

  return {
    exemplos: false,
    balancete: nome => carregar(nome).balancete,
    config: nome => carregar(nome).config,
    carregada: nome => carregada(carregar(nome)),
    salvarConfig(nome, nova) {
      const c = carregar(nome);
      if (!carregada(c) || cr.mesmaConfig(c.config, nova)) return; // antes de chegar do banco, nunca grava
      const gravar = { contas: nova.contas, nomes: nova.nomes, atualizadoEm: new Date().toISOString() };
      c.config = gravar; // a tela já vê a mudança; o banco confirma pelo onSnapshot
      avisarTodos();
      setDoc(doc(db, 'extrator', formatos.slug(nome), 'creditor', 'contas'), gravar)
        .catch((err: Error) => avisar('Não deu para salvar "' + nome + '" na nuvem: ' + err.message));
    },
    assinar(f) {
      ouvintes.add(f);
      return () => { ouvintes.delete(f); };
    },
    versao: () => ver,
    definirAviso(fn) { avisar = fn; },
  };
}
