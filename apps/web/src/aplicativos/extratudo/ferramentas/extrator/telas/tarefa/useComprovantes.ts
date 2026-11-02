// ViewModel da aba Comprovantes da Importação (Vitor, 26/10/2026: "quero baixar os comprovantes usando o algoritmo de buscar
// no Gmail… onde eu consigo puxar e visualizar"; "separa comprovantes por banco também"; "deixe idêntico ao extrato"). Um
// bloco por banco, como na aba Bancos, com a grade dos meses do período: o comprovante do mês que está no Drive (a pasta
// EXTRATOS/<ano>/<mês>/COMPROVANTES/<BANCO>, onde o robô do arquivamento guarda) com o olhinho; o que falta, o ícone de
// importar com as opções do extrato (do computador, buscar no Drive, buscar no e-mail). O que vai para o Drive passa pelo
// robô; enquanto ele grava, o mês mostra o Drive com a rodinha, e a pasta é lida de novo quando ele termina.
import { creditor as cr, extrator as x } from '@nads/core';
import workerDoPdf from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { useEffect, useRef, useState } from 'react';
import { useSessao } from '../../casca/sessao';
import { useDrive } from '../../dados/repo';
import { useBuscarNoEmail, type LidoDoAnexo } from './JanelaBuscarNoEmail';

x.definirWorkerDoPdf(workerDoPdf);

const mensagemDeErro = (e: unknown) => (e instanceof Error ? e.message : String(e));
// o comprovante não tem lançamentos para ler: a prévia mostra só o PDF
const semLeitura = async (): Promise<LidoDoAnexo> => ({ lancamentos: 0, meses: [], primeiros: [] });
const rotuloDoMes = (m: string) => m.slice(5) + '/' + m.slice(0, 4);
/** o envio que o robô não gravou em 15 minutos sai da rodinha (fica o aviso do Atualizar) */
const DESISTE_MS = 15 * 60 * 1000;

export interface BancoDosComprovantes { id: string; nome: string; marca: string; conta?: string }

export function useComprovantes(meses: readonly string[], bancos: readonly BancoDosComprovantes[], pedirLogin: (depois: () => void) => void,
  avisar: (texto: string) => void, avisarErro: (titulo: string, texto: string) => void) {
  const s = useSessao();
  const { drive, acesso } = useDrive();
  const [pasta, setPasta] = useState<{ raiz: string; itens: Parameters<typeof x.comprovantesNoDrive>[0] } | null>(null);
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState('');
  // os envios que o robô ainda não gravou: 'banco|mês' → os ids (e quando foram)
  const [mandando, setMandando] = useState<Record<string, { id: string; em: number }[]>>({});
  const vivo = useRef(true);
  useEffect(() => { vivo.current = true; return () => { vivo.current = false; }; }, []);
  const pode = acesso.entrou || drive.exemplos;

  async function ler(atualizar = false) {
    setLendo(true); setErro('');
    try {
      let p = await drive.pastaDoCliente(s.codigo);
      if (atualizar && p?.raiz && drive.atualizarMapaDoCliente) { await drive.atualizarMapaDoCliente(p.raiz); p = await drive.pastaDoCliente(s.codigo); }
      if (!vivo.current) return;
      setPasta(p ? { raiz: p.raiz, itens: p.itens } : null);
      if (!p) setErro('A pasta desta empresa não está no mapa do Drive.');
    } catch (e) { if (vivo.current) setErro(mensagemDeErro(e)); } finally { if (vivo.current) setLendo(false); }
  }
  // lê a pasta ao abrir a aba (com o login do Entregas; sem ele, o Buscar no Drive pede)
  useEffect(() => { if (pode) void ler(); }, [pode, s.codigo]); // eslint-disable-line react-hooks/exhaustive-deps
  const comLogin = (f: () => void) => { if (!pode) { pedirLogin(f); return; } f(); };

  /** o comprovante vai para o Drive pelo robô do arquivamento (a pasta COMPROVANTES do banco no mês) */
  async function mandar(b: BancoDosComprovantes, fs: File[], mes: string) {
    if (!fs.length) return;
    if (!drive.enviarAoDrive) { avisarErro('Não enviei para o Drive', 'O envio ao Drive só funciona com o login do Entregas.'); return; }
    if (!acesso.entrou && !drive.exemplos) { pedirLogin(() => { void mandar(b, fs, mes); }); return; }
    try {
      for (const f of fs) {
        // o nome no molde do extrato: o robô grava direto na pasta COMPROVANTES do banco no mês (27/10/2026)
        const id = await drive.enviarAoDrive({ nome: x.nomeDoComprovanteDoMes(b.nome, mes, f.name), bytes: new Uint8Array(await f.arrayBuffer()) }, { competencia: mes, codigo: s.codigo, cliente: s.nome });
        if (id) setMandando(m => ({ ...m, [b.id + '|' + mes]: [...(m[b.id + '|' + mes] || []), { id, em: Date.now() }] }));
      }
      avisar('Enviado para o Drive: ' + fs.map(f => f.name).join(', ') + ' (vai para a pasta COMPROVANTES do ' + b.nome + ' em ' + rotuloDoMes(mes) + ', em até 2 minutos)');
    } catch (e) { avisarErro('Não enviei para o Drive', mensagemDeErro(e)); }
  }

  // acompanha os envios: o robô gravou (ou deu erro, ou passou de 15 minutos), sai da rodinha e a pasta é lida de novo
  const ids = Object.values(mandando).flat().map(e => e.id).join(',');
  useEffect(() => {
    if (!ids || !drive.situacaoDosEnvios) return;
    const t = setInterval(() => {
      void drive.situacaoDosEnvios?.(ids.split(',')).then(sit => {
        if (!vivo.current) return;
        const agora = Date.now();
        const acabou = (e: { id: string; em: number }) => ['pronto', 'erro'].includes(sit[e.id]?.status || '') || agora - e.em > DESISTE_MS;
        const algum = Object.values(mandando).flat().some(acabou);
        if (!algum) return;
        const erros = Object.values(mandando).flat().filter(e => sit[e.id]?.status === 'erro');
        if (erros.length) avisarErro('O robô não arquivou ' + (erros.length === 1 ? 'um comprovante' : erros.length + ' comprovantes'), 'Confira em Admin › Arquivador.');
        setMandando(m => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v.filter(e => !acabou(e))]).filter(([, v]) => v.length)));
        void ler(true);
      }, () => undefined);
    }, 10000);
    return () => clearInterval(t);
  }, [ids]); // eslint-disable-line react-hooks/exhaustive-deps

  const em = useBuscarNoEmail((linha, fs, ms) => {
    const b = bancos.find(y => y.id === linha.id);
    if (b) void mandar(b, fs, ms[0] || meses[0]);
  }, pedirLogin, s.codigo, semLeitura, { comprovantes: true });
  const porMes = x.comprovantesNoDrive(pasta?.itens || [], pasta?.raiz || null, meses);
  const unico = bancos.length === 1;
  const doBanco = (b: BancoDosComprovantes, m: string) => x.comprovantesDoBanco(porMes[m] || [], cr.bancoDaLinha(b.nome, b.id), unico);

  /**
   * Vários comprovantes de uma vez (Vitor, 27/10/2026: "Upar todos no Drive / Upar restante, igual a outra tela"): cada um no
   * seu mês, pela data do nome ou do PDF; os restantes = só os dos meses que ainda não têm comprovante no Drive.
   */
  async function todosDoComputador(b: BancoDosComprovantes, fs: File[], restantes: boolean) {
    if (!fs.length) return;
    const semMes: string[] = [];
    const pulados: string[] = [];
    const porMesDoArquivo = new Map<string, File[]>();
    for (const f of fs) {
      let texto = '';
      try {
        const bytes = new Uint8Array(await f.arrayBuffer());
        if (x.ehPdf(bytes)) texto = (await x.itensDoPdf(bytes)).flat().map(i => i.texto).join(' ');
      } catch { /* sem texto: fica o nome */ }
      const mes = x.mesDoComprovante(f.name, texto, meses);
      if (!mes) { semMes.push(f.name); continue; }
      if (restantes && doBanco(b, mes).length) { pulados.push(f.name); continue; }
      porMesDoArquivo.set(mes, [...(porMesDoArquivo.get(mes) || []), f]);
    }
    for (const [mes, lista] of porMesDoArquivo) await mandar(b, lista, mes);
    if (semMes.length) avisarErro('Não achei o mês de ' + (semMes.length === 1 ? 'um comprovante' : semMes.length + ' comprovantes'),
      semMes.join(', ') + ': sem data do período no nome nem no PDF. Importe pelo mês, na grade.');
    if (pulados.length) avisar((pulados.length === 1 ? '1 comprovante ficou' : pulados.length + ' comprovantes ficaram') + ' de fora: o mês já tem comprovante no Drive (' + pulados.join(', ') + ').');
  }

  return {
    lendo, erro, entrou: pode, buscaExiste: em.existe, em,
    bancos: bancos.map(b => {
      const alvo = cr.bancoDaLinha(b.nome, b.id);
      const linhas = meses.map(m => ({ mes: m, rotulo: rotuloDoMes(m), arquivos: x.comprovantesDoBanco(porMes[m] || [], alvo, unico), enviando: (mandando[b.id + '|' + m] || []).length > 0 }));
      return { ...b, meses: linhas, comArquivo: linhas.filter(l => l.arquivos.length).length };
    }),
    /** todos de uma vez, do computador (restantes: só os meses sem comprovante no Drive) */
    todosDoComputador: (b: BancoDosComprovantes, fs: File[], restantes: boolean) => { void todosDoComputador(b, fs, restantes); },
    /** as opções do mês sem comprovante (as mesmas do extrato) */
    doComputador: (b: BancoDosComprovantes, fs: File[], mes: string) => { void mandar(b, fs, mes); },
    buscarNoDrive: () => comLogin(() => { void ler(true); }),
    buscarNoEmail: (b: BancoDosComprovantes, mes: string) => em.abrir({ id: b.id, nome: b.nome }, mes),
    /** o link temporário para ver o comprovante (a View abre a janela) */
    link: (a: { id: string; nome: string }) => drive.link(a.id, a.nome),
  };
}

export type VmComprovantes = ReturnType<typeof useComprovantes>;
