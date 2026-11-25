// ViewModel de Cadastro › Obrigações (plano do Acessórias, ficha E08): as etapas do Fiscal e do Contábil desta empresa,
// com o padrão da rotina (pelo regime e pelo mês) e o que a empresa tem de diferente: "tem", "não tem" e outro dia do
// prazo, a partir de uma competência. O catálogo continua no código (tarefas/rotinas); aqui só o ajuste por empresa.
// Quem pode mudar: quem edita o cadastro (como os outros parâmetros). Fica a pergunta ao dono se só o Diretor e o
// responsável do setor daquela empresa devem poder.
import { empresas, tarefas } from '@nads/core';
import { useState } from 'react';
import { competenciaDeHoje, rotuloCompetencia, useCadastroAberto } from '../useCadastroAberto';

type Setor = empresas.cadastro.SetorDoAjuste;
export type EscolhaDaEtapa = 'rotina' | 'tem' | 'nao-tem';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** A competência `n` meses depois de 'aaaa-mm' (n negativo = antes). */
export function somarMeses(competencia: string, n: number): string {
  const d = new Date(Number(competencia.slice(0, 4)), Number(competencia.slice(5, 7)) - 1 + n, 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

/** O padrão da rotina para a etapa nesta empresa (sem o ajuste): tem ou não, e por quê. */
export function padraoDaEtapa(e: tarefas.Etapa, regime: string): { tem: boolean; texto: string } {
  if (e.regimes && regime && !e.regimes.includes(regime)) return { tem: false, texto: 'Pela rotina: não tem (só ' + e.regimes.join(', ') + ')' };
  const meses = e.meses ? ' (só em ' + e.meses.map(m => MESES[m - 1]).join(', ') + ')' : '';
  return { tem: true, texto: 'Pela rotina: tem' + meses };
}

export function useObrigacoesDaEmpresa(rota: string) {
  const c = useCadastroAberto(rota);
  const hoje = competenciaDeHoje();
  const [desde, setDesde] = useState<string>(hoje);
  const codigo = c.empresa.codigo;
  const regime = tarefas.regimeDaEmpresa(codigo, hoje) || c.empresa.regime || '';

  const setores = (['fiscal', 'contabil'] as const).map(setor => {
    const rotina = tarefas.rotinaDaEmpresa(setor, codigo);
    const etapas = (rotina?.etapas || []).filter(e => !e.soQuandoAdicionada).map(e => {
      const ajuste = c.cadastro.etapas?.[setor]?.[e.id] || null;
      const prazo = tarefas.linhaDoPrazo(setor, e.id);
      const padrao = padraoDaEtapa(e, regime);
      const escolha: EscolhaDaEtapa = ajuste?.ligada === true ? 'tem' : ajuste?.ligada === false ? 'nao-tem' : 'rotina';
      return {
        id: e.id,
        nome: e.nome,
        padrao: padrao.texto,
        escolha,
        /** o que vale agora, já com o ajuste (o `desde` no futuro ainda não vale) */
        temAgora: empresas.cadastro.ajusteQueVale(c.cadastro.etapas, setor, e.id, hoje)?.ligada ?? padrao.tem,
        ajuste: ajuste ? empresas.cadastro.ajusteLegivel(ajuste) : '',
        /** o dia da tabela de prazos (só nas etapas que têm prazo); null = sem prazo */
        diaPadrao: prazo && typeof prazo.dia === 'number' ? prazo.dia : null,
        dia: ajuste?.dia ?? null,
      };
    });
    return { setor, titulo: setor === 'fiscal' ? 'Fiscal' : 'Contábil', etapas };
  }).filter(s => s.etapas.length);

  function gravar(setor: Setor, etapa: string, nome: string, mudar: (a: empresas.cadastro.AjusteDaEtapa) => empresas.cadastro.AjusteDaEtapa) {
    if (c.carregando) return;
    const atual = c.cadastro.etapas?.[setor]?.[etapa] || {};
    const novo = mudar({ ...atual });
    if (desde) novo.desde = desde; else delete novo.desde;
    const cad = empresas.cadastro.ajustarEtapa(c.cadastro, setor, etapa, novo, nome, c.por, new Date());
    if (cad !== c.cadastro) c.salvar(cad);
  }

  return {
    empresa: c.empresa,
    carregando: c.carregando,
    regime,
    setores,
    /** a partir de qual competência a mudança vale ('' = sempre) */
    desde,
    setDesde,
    opcoesDeDesde: [
      { valor: '', rotulo: 'Sempre (todos os meses)' },
      ...[-3, -2, -1, 0, 1, 2, 3].map(n => {
        const v = somarMeses(hoje, n);
        return { valor: v, rotulo: rotuloCompetencia(v) + (n === 0 ? ' (este mês)' : '') };
      }),
    ],
    escolher(setor: Setor, etapa: string, nome: string, escolha: EscolhaDaEtapa) {
      gravar(setor, etapa, nome, a => {
        if (escolha === 'rotina') delete a.ligada; else a.ligada = escolha === 'tem';
        return a;
      });
    },
    mudarDia(setor: Setor, etapa: string, nome: string, dia: number | null) {
      gravar(setor, etapa, nome, a => {
        if (dia == null) delete a.dia; else a.dia = dia;
        return a;
      });
    },
  };
}
