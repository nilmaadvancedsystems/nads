// ViewModel do Consultar na Receita do Cadastro › Empresa (17/11/2026: "um botão no nads que consulte na Receita a situação
// da empresa e traga os dados atualizados"): consulta o CNPJ na hora, mostra o antes × depois (o que o nads tem e o que a
// Receita disse) e grava só as linhas que a pessoa marcar. Nada é sobrescrito sozinho. A regra (ler, comparar, gravar) é do
// core (empresas.cadastro.situacaoNaReceita); a consulta, de dados/receita.ts.
import { empresas } from '@nads/core';
import { useMemo, useState } from 'react';
import { podeMexerNoCadastro, podeTrocarRazaoSocial } from '../../../casca/navegacao';
import type { Operador } from '../../../casca/operador';
import { empresasNovas } from '../../../dados/fonte';
import { consultarSituacaoNaReceita } from '../../../dados/receita';

type Campo = empresas.cadastro.CampoDaReceita;

export interface EntradaDaConsulta {
  cadastro: empresas.cadastro.CadastroDaEmpresa;
  /** o nome da lista do escritório */
  nomeDaLista: string;
  /** o CNPJ que vale (o do cadastro; sem ele, o do Entregas) */
  cnpj: string;
  /** o que o Entregas sabe (o vigia de toda semana e o cadastro de lá) */
  doEntregas: Partial<empresas.cadastro.RetratoDaReceita>;
  regimeQueVale: string;
  carregando: boolean;
  por: string;
  operador: Operador | null;
  /** grava; true = o banco aceitou */
  salvar(c: empresas.cadastro.CadastroDaEmpresa): Promise<boolean>;
}

/** Uma linha do antes × depois na tela: a da regra, marcada ou não, e por que não dá para marcar. */
export interface LinhaDaConsulta extends empresas.cadastro.DiferencaDaReceita {
  marcada: boolean;
  /** dá para marcar (gravável, mudou ou novo, e a pessoa pode) */
  escolhivel: boolean;
  /** por que não dá (só o diretor troca a razão social…) */
  bloqueio?: string;
}

export function useConsultaNaReceita(e: EntradaDaConsulta) {
  const [consultando, setConsultando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [retrato, setRetrato] = useState<empresas.cadastro.RetratoDaReceita | null>(null);
  const [escolhidos, setEscolhidos] = useState<ReadonlySet<Campo>>(new Set());
  const [aviso, setAviso] = useState<string | null>(null);
  const [gravado, setGravado] = useState(false);
  const [gravando, setGravando] = useState(false);

  const podeGravar = podeMexerNoCadastro(e.operador);
  const podeRazao = podeTrocarRazaoSocial(e.operador);
  const cnpjValido = empresas.cadastro.cnpjValido(e.cnpj);

  // o antes × depois sempre contra o cadastro de agora (depois de gravar, as linhas gravadas ficam iguais)
  const diferencas = useMemo(() => !retrato ? [] : empresas.cadastro.compararComReceita(
    { cadastro: e.cadastro, nomeDaLista: e.nomeDaLista, doEntregas: e.doEntregas, regimeQueVale: e.regimeQueVale }, retrato,
  ), [retrato, e.cadastro, e.nomeDaLista, e.doEntregas, e.regimeQueVale]);

  const bloqueioDe = (l: empresas.cadastro.DiferencaDaReceita): string | undefined =>
    !podeGravar ? 'Só o sênior, o diretor e o admin gravam no cadastro.'
      : l.campo === 'razaoSocial' && !podeRazao ? 'Só o diretor troca a razão social.' : undefined;

  const linhas: LinhaDaConsulta[] = diferencas.map(l => {
    const bloqueio = l.gravavel && l.estado !== 'igual' ? bloqueioDe(l) : undefined;
    const escolhivel = l.gravavel && l.estado !== 'igual' && !bloqueio;
    return { ...l, escolhivel, bloqueio, marcada: escolhivel && escolhidos.has(l.campo) };
  });
  // o que mudou primeiro (em destaque), depois o novo, depois o igual e o que a Receita não informa
  const ORDEM = { mudou: 0, novo: 1, igual: 2, vazio: 3 } as const;
  const ordenadas = [...linhas].sort((a, b) => ORDEM[a.estado] - ORDEM[b.estado]);
  const paraEscolher = linhas.filter(l => l.escolhivel);
  const marcadas = paraEscolher.filter(l => l.marcada);

  async function consultar() {
    if (consultando) return;
    setErro(null); setAviso(null); setGravado(false);
    if (!cnpjValido) { setErro(e.cnpj ? empresas.cadastro.MENSAGEM_DA_FALHA.invalido : 'A empresa não tem CNPJ no cadastro nem no Entregas.'); return; }
    setConsultando(true);
    try {
      const r = await consultarSituacaoNaReceita(e.cnpj);
      // o que o nads não sabia (novo) já vem marcado: não apaga nada; o que mudou, a pessoa marca
      const novos = empresas.cadastro.compararComReceita({ cadastro: e.cadastro, nomeDaLista: e.nomeDaLista, doEntregas: e.doEntregas, regimeQueVale: e.regimeQueVale }, r)
        .filter(l => l.estado === 'novo' && l.gravavel && l.campo !== 'regime' && !bloqueioDe(l)).map(l => l.campo);
      setEscolhidos(new Set(novos));
      setRetrato(r);
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    } finally {
      setConsultando(false);
    }
  }

  async function gravar() {
    if (!retrato || e.carregando || !podeGravar || gravando) return;
    const outras = [...empresas.EMPRESAS_COM_DP, ...empresasNovas()].map(x => ({ codigo: x.codigo, nome: x.nome, razaoSocial: empresas.nomeParaMostrar(x) }));
    const r = empresas.cadastro.gravarDaReceita(e.cadastro, retrato, diferencas, marcadas.map(l => l.campo), { por: e.por, agora: new Date(), outras });
    setAviso(null); setGravado(false); setGravando(true);
    // "Gravado" só depois de o banco aceitar (19/11/2026: na 610 o banco recusava e a janela dizia "Gravado no cadastro");
    // se recusar, o aviso do banco já aparece e as marcas ficam, para tentar de novo
    const ok = r.cadastro === e.cadastro || await e.salvar(r.cadastro);
    setGravando(false);
    if (!ok) { setAviso('Não gravou: o banco recusou. Nada mudou no cadastro.'); return; }
    setAviso(r.erros.length ? r.erros.join(' ') : null);
    setEscolhidos(new Set());
    setGravado(true);
  }

  return {
    /** dá para consultar (tem CNPJ) */
    temCnpj: !!e.cnpj,
    consultando,
    erro,
    /** a janela do antes × depois está aberta */
    aberta: !!retrato,
    consultadoEm: retrato?.consultadoEm || '',
    linhas: ordenadas,
    /** quantas mudaram e quantas pedem atenção */
    mudaram: linhas.filter(l => l.estado === 'mudou').length,
    novos: linhas.filter(l => l.estado === 'novo').length,
    graves: linhas.filter(l => l.grave && l.estado !== 'igual').length,
    paraEscolher: paraEscolher.length,
    marcadas: marcadas.length,
    podeGravar,
    /** a razão social que não trocou (o nome de outra empresa) */
    aviso,
    /** já gravou nesta consulta (o banco aceitou) */
    gravado,
    /** esperando o banco responder */
    gravando,
    consultar,
    marcar(campo: Campo, sim: boolean) {
      setEscolhidos(atual => { const s = new Set(atual); if (sim) s.add(campo); else s.delete(campo); return s; });
    },
    marcarTodas(sim: boolean) {
      setEscolhidos(sim ? new Set(paraEscolher.map(l => l.campo)) : new Set());
    },
    gravar,
    fechar() { setRetrato(null); setEscolhidos(new Set()); setAviso(null); setGravado(false); },
  };
}
