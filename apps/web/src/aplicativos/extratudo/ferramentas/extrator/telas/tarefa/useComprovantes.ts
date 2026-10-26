// ViewModel da aba Comprovantes da Importação (Vitor, 26/10/2026: "quero baixar os comprovantes usando o algoritmo de buscar
// no Gmail… onde eu consigo puxar e visualizar; pode pegar o mesmo front end de Bancos"). Os meses do período numa grade,
// como a de cada banco: em cada mês, o Buscar no e-mail (a mesma busca do extrato, no modo comprovantes: o anexo escolhido vai
// para o Drive, na pasta COMPROVANTES do mês, pelo robô do arquivamento) e quantos comprovantes já estão no Drive; o mês
// aberto lista os de lá para ver. Enquanto o robô grava, o mês mostra "mandando"; gravou, a pasta é lida de novo.
import { extrator as x } from '@nads/core';
import { useEffect, useRef, useState } from 'react';
import { useSessao } from '../../casca/sessao';
import { useDrive } from '../../dados/repo';
import { useBuscarNoEmail, type LidoDoAnexo } from './JanelaBuscarNoEmail';

const mensagemDeErro = (e: unknown) => (e instanceof Error ? e.message : String(e));
// o comprovante não tem lançamentos para ler: a prévia mostra só o PDF
const semLeitura = async (): Promise<LidoDoAnexo> => ({ lancamentos: 0, meses: [], primeiros: [] });
const LINHA = { id: 'comprovantes', nome: 'Comprovantes' };

export function useComprovantes(meses: readonly string[], pedirLogin: (depois: () => void) => void) {
  const s = useSessao();
  const { drive, acesso } = useDrive();
  const [pasta, setPasta] = useState<{ raiz: string; itens: Parameters<typeof x.comprovantesNoDrive>[0] } | null>(null);
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState('');
  const [aberto, setAberto] = useState<string | null>(null);
  // os envios ao Drive que o robô ainda não gravou, por mês
  const [mandando, setMandando] = useState<Record<string, string[]>>({});
  const vivo = useRef(true);
  useEffect(() => () => { vivo.current = false; }, []);
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
  // lê a pasta ao abrir a aba (com o login do Entregas; sem ele, espera o Atualizar)
  useEffect(() => { if (pode) void ler(); }, [pode, s.codigo]); // eslint-disable-line react-hooks/exhaustive-deps

  /** o arquivo escolhido no e-mail vai para o Drive (a pasta COMPROVANTES do mês: o robô do arquivamento põe lá) */
  async function mandar(fs: File[], mes: string) {
    if (!drive.enviarAoDrive) { setErro('O envio ao Drive só funciona com o login do Entregas.'); return; }
    try {
      for (const f of fs) {
        const id = await drive.enviarAoDrive({ nome: x.nomeDoComprovante(f.name), bytes: new Uint8Array(await f.arrayBuffer()) }, { competencia: mes, codigo: s.codigo, cliente: s.nome });
        if (id) setMandando(m => ({ ...m, [mes]: [...(m[mes] || []), id] }));
      }
      setAberto(mes);
    } catch (e) { setErro('Não mandei para o Drive: ' + mensagemDeErro(e)); }
  }

  // acompanha os envios: o robô gravou (ou deu erro), sai do "mandando" e a pasta é lida de novo
  const ids = Object.values(mandando).flat().join(',');
  useEffect(() => {
    if (!ids || !drive.situacaoDosEnvios) return;
    const t = setInterval(() => {
      void drive.situacaoDosEnvios?.(ids.split(',')).then(sit => {
        const prontos = ids.split(',').filter(id => ['pronto', 'erro'].includes(sit[id]?.status || ''));
        if (!prontos.length || !vivo.current) return;
        setMandando(m => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v.filter(id => !prontos.includes(id))]).filter(([, v]) => v.length)));
        void ler(true);
      }, () => undefined);
    }, 15000);
    return () => clearInterval(t);
  }, [ids]); // eslint-disable-line react-hooks/exhaustive-deps

  const em = useBuscarNoEmail((_linha, fs, ms) => { void mandar(fs, ms[0] || meses[0]); }, pedirLogin, s.codigo, semLeitura, { comprovantes: true });
  const porMes = x.comprovantesNoDrive(pasta?.itens || [], pasta?.raiz || null, meses);
  const total = Object.values(porMes).reduce((n, l) => n + l.length, 0);
  const mesAberto = aberto && meses.includes(aberto) ? aberto : meses.find(m => porMes[m].length) || null;

  return {
    meses: meses.map(m => ({ mes: m, rotulo: m.slice(5) + '/' + m.slice(0, 4), qtd: porMes[m].length, mandando: (mandando[m] || []).length })),
    total, lendo, erro, entrou: pode,
    /** relê a pasta do cliente no Drive (pede o login quando falta) */
    atualizar: () => { if (!pode) { pedirLogin(() => { void ler(true); }); return; } void ler(true); },
    /** o mês aberto e os comprovantes dele no Drive */
    mesAberto, abrirMes: (m: string) => setAberto(m),
    doMes: mesAberto ? porMes[mesAberto] : [],
    /** o Buscar no e-mail do mês (a janela de busca, no modo comprovantes) */
    buscarNoEmail: (m: string) => em.abrir(LINHA, m),
    buscaExiste: em.existe,
    em,
    /** o link temporário para ver o comprovante (a View abre a janela) */
    link: (a: { id: string; nome: string }) => drive.link(a.id, a.nome),
  };
}

export type VmComprovantes = ReturnType<typeof useComprovantes>;
