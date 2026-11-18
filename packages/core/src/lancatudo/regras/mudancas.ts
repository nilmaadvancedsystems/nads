// As mudanças do Lançatudo, como funções puras (o estado de antes → o novo): as regras da empresa, o que a pessoa decide
// numa linha (e o que o nads aprende com isso) e o registro das exportações.
import type { ConfigDoLancatudo, DecisaoDaLinha, ExportacaoFeita, LinhaDoRegistro, MesDoLancatudo, RegraDoLancatudo } from '../tipos';
import { chaveLembrada, historicoLimpo } from './motor';

/** A decisão ainda diz alguma coisa? (senão sai do documento) */
const temAlgo = (d: DecisaoDaLinha) => d.conta !== undefined || !!d.historico || d.codHistorico !== undefined || !!d.documento || !!d.ignorar;

export const configVazia = (): ConfigDoLancatudo => ({ regras: [], lembradas: {} });
export const mesVazio = (competencia: string): MesDoLancatudo => ({ competencia, decisoes: {}, exportacoes: [] });

/** Os campos que a pessoa preenche numa regra. */
export type DadosDaRegra = Omit<RegraDoLancatudo, 'id' | 'criadaEm' | 'por'>;

/** O que falta para a regra valer (null = pode gravar). */
export function problemaDaRegra(r: DadosDaRegra): string | null {
  if (!r.expressao.trim()) return r.tipo === 'favorecido' ? 'Informe o nome ou o CPF/CNPJ do favorecido.' : 'Informe o texto que aparece no histórico do banco.';
  if (!r.expressao.replace(/[*\s]/g, '')) return 'A expressão não pode ser só *.';
  if (!/^\d+$/.test(r.conta.trim())) return 'Informe o código reduzido da conta (só números).';
  if (r.codHistorico && !/^\d{1,10}$/.test(r.codHistorico.trim())) return 'O código do histórico tem só números (até 10).';
  return null;
}

const novoId = (agora: Date, existentes: readonly { id: string }[]) => {
  const base = 'r' + agora.getTime().toString(36);
  let id = base, n = 1;
  while (existentes.some(r => r.id === id)) id = base + '-' + n++;
  return id;
};

const limpa = (r: DadosDaRegra): DadosDaRegra => ({
  tipo: r.tipo, expressao: r.expressao.trim(), sentido: r.sentido, conta: r.conta.trim(), comHistoricoDoExtrato: !!r.comHistoricoDoExtrato,
  ...(r.descricao?.trim() ? { descricao: r.descricao.trim() } : {}),
  ...(r.banco ? { banco: r.banco } : {}),
  ...(r.historico?.trim() ? { historico: r.historico.trim().slice(0, 250) } : {}),
  ...(r.codHistorico?.trim() ? { codHistorico: r.codHistorico.trim() } : {}),
});

export function criarRegra(c: ConfigDoLancatudo, dados: DadosDaRegra, agora: Date, por: string): ConfigDoLancatudo {
  const r: RegraDoLancatudo = { ...limpa(dados), id: novoId(agora, c.regras), criadaEm: agora.toISOString(), por };
  return { ...c, regras: [...c.regras, r] };
}

/** Altera a regra: quem criou continua o mesmo; a alteração fica em alteradaEm/alteradaPor (18/11/2026: "coloca o nome de quem criou"). */
export function editarRegra(c: ConfigDoLancatudo, id: string, dados: DadosDaRegra, por: string, agora?: Date): ConfigDoLancatudo {
  if (!c.regras.some(r => r.id === id)) return c;
  const em = (agora || new Date()).toISOString();
  return { ...c, regras: c.regras.map(r => (r.id === id ? { ...limpa(dados), id, criadaEm: r.criadaEm, por: r.por || por, alteradaEm: em, alteradaPor: por } : r)) };
}

/** Exclui a regra: as linhas que ela conciliava voltam a ficar sem conta (ou caem na próxima regra que casar). */
export function excluirRegras(c: ConfigDoLancatudo, ids: readonly string[]): ConfigDoLancatudo {
  const fora = new Set(ids);
  return { ...c, regras: c.regras.filter(r => !fora.has(r.id)) };
}

function comDecisao(m: MesDoLancatudo, banco: string, chave: string, mudar: (d: DecisaoDaLinha | undefined) => DecisaoDaLinha | null): MesDoLancatudo {
  const doBanco = { ...(m.decisoes[banco] || {}) };
  const nova = mudar(doBanco[chave]);
  if (nova) doBanco[chave] = nova; else delete doBanco[chave];
  return { ...m, decisoes: { ...m.decisoes, [banco]: doBanco } };
}

/** A pessoa escolhe a conta das linhas (uma ou várias): grava a decisão e o nads aprende a conta do favorecido. */
export function escolherConta(m: MesDoLancatudo, c: ConfigDoLancatudo, banco: string, linhas: readonly Pick<LinhaDoRegistro, 'chave' | 'historicoDoBanco' | 'valor'>[], conta: string, agora: Date, por: string):
  { mes: MesDoLancatudo; config: ConfigDoLancatudo } {
  const em = agora.toISOString();
  let mes = m;
  const lembradas = { ...c.lembradas };
  for (const l of linhas) {
    mes = comDecisao(mes, banco, l.chave, d => ({ ...d, conta, em, por }));
    const k = chaveLembrada(l.historicoDoBanco, l.valor);
    if (k && conta) lembradas[k] = { conta, exemplo: historicoLimpo(l.historicoDoBanco).slice(0, 120), em, por };
  }
  return { mes, config: { ...c, lembradas } };
}

/** O que a janela da linha grava de uma vez (o Gravar do "Lançamentos (Cadastramento)"). */
export interface RascunhoDaLinha { conta: string; historico: string; codHistorico: string; documento: string }

/**
 * Grava a janela da linha: a conta (trocada, o nads aprende o favorecido; vazia, a linha fica sem conta), o histórico (igual
 * ao automático, não fica guardado) e o código do histórico padrão. Só o que mudou em relação à linha como estava.
 */
export function gravarLinha(m: MesDoLancatudo, c: ConfigDoLancatudo, banco: string, linha: Pick<LinhaDoRegistro, 'chave' | 'historicoDoBanco' | 'valor' | 'conta' | 'historico' | 'codHistorico' | 'documento'> & { origem?: LinhaDoRegistro['origem'] },
  r: RascunhoDaLinha, agora: Date, por: string): { mes: MesDoLancatudo; config: ConfigDoLancatudo } {
  let mes = m, config = c;
  const conta = r.conta.trim();
  // a sugerida pelo razão gravada como está vira escolhida (18/11/2026: "não tem como eu resolver esse 'sugerido'?")
  if (conta !== (linha.conta || '') || (conta && linha.origem === 'razao')) {
    if (conta) ({ mes, config } = escolherConta(mes, config, banco, [linha], conta, agora, por));
    else mes = removerConta(mes, banco, linha.chave, agora, por);
  }
  const historico = r.historico.trim();
  if (historico !== linha.historico) mes = editarHistorico(mes, banco, linha.chave, historico, agora, por);
  const cod = r.codHistorico.trim();
  if (cod !== (linha.codHistorico || '')) mes = comDecisao(mes, banco, linha.chave, d => ({ ...(d || { em: '', por: '' }), codHistorico: cod, em: agora.toISOString(), por }));
  const documento = r.documento.trim().slice(0, 20);
  if (documento !== (linha.documento || '')) {
    mes = comDecisao(mes, banco, linha.chave, d => {
      const nova: DecisaoDaLinha = { ...(d || { em: '', por: '' }), em: agora.toISOString(), por };
      if (documento) nova.documento = documento; else delete nova.documento;
      return temAlgo(nova) ? nova : null;
    });
  }
  return { mes, config };
}

/** Tira a conta da linha (fica sem conta, mesmo com regra ou conta aprendida). */
export function removerConta(m: MesDoLancatudo, banco: string, chave: string, agora: Date, por: string): MesDoLancatudo {
  return comDecisao(m, banco, chave, d => ({ ...d, conta: '', em: agora.toISOString(), por }));
}

/** Volta a linha ao automático (regra, conta aprendida ou sugestão), mantendo o histórico editado. */
export function voltarAoAutomatico(m: MesDoLancatudo, banco: string, chave: string): MesDoLancatudo {
  return comDecisao(m, banco, chave, d => {
    if (!d) return null;
    const resto: DecisaoDaLinha = { ...d };
    delete resto.conta;
    return temAlgo(resto) ? resto : null;
  });
}

/** Troca o histórico da linha (vazio = volta ao do extrato ou da regra). */
export function editarHistorico(m: MesDoLancatudo, banco: string, chave: string, historico: string, agora: Date, por: string): MesDoLancatudo {
  const h = historico.trim().slice(0, 250);
  return comDecisao(m, banco, chave, d => {
    const nova: DecisaoDaLinha = { ...(d || { em: '', por: '' }), em: agora.toISOString(), por };
    if (h) nova.historico = h; else delete nova.historico;
    return temAlgo(nova) ? nova : null;
  });
}

/** Tira a linha da exportação (ou volta com ela). */
export function ignorarLinha(m: MesDoLancatudo, banco: string, chave: string, ignorar: boolean, agora: Date, por: string): MesDoLancatudo {
  return comDecisao(m, banco, chave, d => {
    const nova: DecisaoDaLinha = { ...(d || { em: '', por: '' }), em: agora.toISOString(), por };
    if (ignorar) nova.ignorar = true; else delete nova.ignorar;
    return temAlgo(nova) ? nova : null;
  });
}

/** Esquece a conta aprendida de um favorecido. */
export function esquecerLembrada(c: ConfigDoLancatudo, chave: string): ConfigDoLancatudo {
  if (!(chave in c.lembradas)) return c;
  const lembradas = { ...c.lembradas };
  delete lembradas[chave];
  return { ...c, lembradas };
}

/** Guarda a exportação (as mais novas primeiro; até 200 no mês). */
export function registrarExportacao(m: MesDoLancatudo, e: ExportacaoFeita): MesDoLancatudo {
  return { ...m, exportacoes: [e, ...m.exportacoes].slice(0, 200) };
}

/**
 * O código contábil da conta bancária, escolhido no Lançatudo (18/11/2026: "tem que ter como configurar por aqui as contas"):
 * só dígitos; vazio tira. Vale quando o Cadastro não tem o código dessa conta.
 */
export function definirContaDoBanco(c: ConfigDoLancatudo, banco: string, conta: string): ConfigDoLancatudo {
  const codigo = conta.replace(/\D/g, '');
  const contas = { ...(c.contasDosBancos || {}) };
  if (codigo) contas[banco] = codigo; else delete contas[banco];
  return { ...c, contasDosBancos: contas };
}

/** O código contábil da conta bancária: o do Cadastro; sem ele, o escolhido no Lançatudo. */
export function contaDoBancoNaConfig(c: ConfigDoLancatudo, banco: string, doCadastro: string | undefined): string {
  return (doCadastro || '').trim() || c.contasDosBancos?.[banco] || '';
}
