// As marcas da etapa Clientes de cada empresa e mês (Pendente / Ok / Conferido e a observação), sempre a versão mais nova.
// No site ligado ao banco, no Firestore (clientes.firestore.ts); nos exemplos e na empresa de teste (Personaly), só neste
// navegador. A mensagem para o cliente (o modelo) fica neste navegador.
import { clientes as cl, demo, formatos } from '@nads/core';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { gravarMarcasNoBanco, ouvirMarcasNoBanco } from './clientes.firestore';
import { ligadoAoBanco } from '../../../comum/modoDesenvolvedor';

const noBanco = ligadoAoBanco(); // no modo desenvolvedor, os dados de exemplo (nada vai para o banco)
const CHAVE_LOCAL = 'nads-clientes-marcas-v1';
const CHAVE_MENSAGEM = 'nads-clientes-mensagem-v1';

interface Carga { doc: cl.DocClientes; chegou: boolean }
const cargas = new Map<string, Carga>();
const ouvintes = new Set<() => void>();
let ver = 0;
const avisar = () => { ver++; for (const f of ouvintes) f(); };
let aviso: (m: string) => void = m => console.warn(m);

function lerLocal(): Record<string, cl.DocClientes> {
  try { return JSON.parse(localStorage.getItem(CHAVE_LOCAL) || '{}') as Record<string, cl.DocClientes>; } catch { return {}; }
}

function carregar(nome: string, mes: string): Carga {
  const k = formatos.slug(nome) + '|' + mes;
  const pronta = cargas.get(k);
  if (pronta) return pronta;
  const c: Carga = { doc: { contas: {} }, chegou: false };
  cargas.set(k, c);
  if (noBanco && !demo.ehEmpresaDemo(nome)) {
    ouvirMarcasNoBanco(formatos.slug(nome), mes, d => { c.doc = d; c.chegou = true; avisar(); }, m => aviso('Não consegui ler os clientes na nuvem: ' + m));
  } else {
    c.doc = cl.docDoDocumento(lerLocal()[k]);
    c.chegou = true;
  }
  return c;
}

function salvar(nome: string, mes: string, d: cl.DocClientes) {
  const k = formatos.slug(nome) + '|' + mes;
  const c = carregar(nome, mes);
  if (!c.chegou) return; // antes de chegar do banco, nunca grava
  c.doc = d;
  avisar();
  if (noBanco && !demo.ehEmpresaDemo(nome)) {
    gravarMarcasNoBanco(formatos.slug(nome), mes, d).catch((e: Error) => aviso('Não deu para salvar os clientes na nuvem: ' + e.message));
  } else {
    try { localStorage.setItem(CHAVE_LOCAL, JSON.stringify({ ...lerLocal(), [k]: d })); } catch { /* só nesta tela */ }
  }
}

const assinar = (f: () => void) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; };
const versao = () => ver;

/** As marcas da empresa no mês (e se já chegaram do banco) e o salvar. */
export function useMarcasDoMes(nome: string, mes: string, onAviso?: (m: string) => void) {
  useEffect(() => { if (onAviso) aviso = onAviso; }, [onAviso]);
  useSyncExternalStore(assinar, versao, versao);
  const c = mes ? carregar(nome, mes) : { doc: { contas: {} }, chegou: true };
  const gravar = useCallback((d: cl.DocClientes) => { if (mes) salvar(nome, mes, d); }, [nome, mes]);
  return { doc: c.doc, carregado: c.chegou, salvar: gravar };
}

/** O modelo da mensagem para o cliente (neste navegador; sem ele, o padrão). */
export function lerMensagem(): string {
  try { return localStorage.getItem(CHAVE_MENSAGEM) || cl.MENSAGEM_PADRAO; } catch { return cl.MENSAGEM_PADRAO; }
}
export function gravarMensagem(t: string) {
  try { localStorage.setItem(CHAVE_MENSAGEM, t); } catch { /* só nesta tela */ }
}
