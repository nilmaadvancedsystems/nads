// Os lançamentos para o sistema contábil do que entrou ou saiu no banco e não está no razão (Vitor, 13/10/2026: "gere os
// lançamentos para meu sistema contábil; você já viu o padrão pelos históricos que estão no razão já importado").
// O padrão vem do próprio razão da conta: cada linha dele tem a contrapartida (o código e o nome) e o texto do banco
// ("Descrição histórico"). Para cada pendência, a linha do razão com o histórico mais parecido, no mesmo sentido
// (entrada ou saída), dá a contrapartida. Sem nenhuma parecida, vai a contrapartida mais usada naquele sentido, marcada
// para conferir. Entrada: D banco / C contrapartida; saída: D contrapartida / C banco. Só sugere: a pessoa analisa.
import type { LinhaDeImportacao } from '../../creditor/arquivos/gerar';
import type { EmpresaExtrator, Lado, Lancamento, LancamentoDoArquivo } from '../tipos';
import { bancoDoArquivo } from './bancos';
import { conferir } from './conferencia';
import type { CorrecaoDoRazao } from './correcoes';
import { palavras } from './texto';

/** O lançamento do banco que falta no razão (o dia, o valor com sinal e o histórico do extrato). */
export interface PendenteDoBanco { data: string; valor: number; historico: string }

export interface SugestaoDeLancamento {
  linha: LinhaDeImportacao;
  /** a contrapartida escolhida e de onde veio: 'padrao' = histórico parecido no razão; 'mais-usada' = sem parecido */
  conta: string;
  nomeDaConta: string;
  origem: 'padrao' | 'mais-usada';
  /** o histórico do razão que serviu de modelo */
  modelo?: string;
}

/** Quanto os dois históricos precisam ter em comum (sem os números: documento, NSU, CNPJ). */
const PARECIDO_MINIMO = 0.5;

/** As palavras que dizem o tipo do lançamento: sem as que têm número (o documento, o NSU, a data). */
function chave(historico: string): Set<string> {
  return new Set(palavras(historico).filter(p => !/\d/.test(p)));
}

function semelhanca(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let comuns = 0;
  for (const t of a) if (b.has(t)) comuns++;
  return comuns / (a.size + b.size - comuns);
}

const dataBR = (iso: string) => iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4);

/**
 * As sugestões, na ordem das pendências. `razao`: os lançamentos do razão da conta (os que têm `conta`, o código da
 * contrapartida, servem de modelo); `contaDoBanco`: o código contábil da conta do banco (Cadastro › Contas bancárias);
 * `razaoInvertido`: o razão veio com os sinais trocados (o `sistemaInvertido` da conferência).
 */
export function lancamentosParaOSistema(pendentes: readonly PendenteDoBanco[], razao: readonly Lancamento[], contaDoBanco: string, razaoInvertido = false): SugestaoDeLancamento[] {
  const modelos = razao.filter(l => l.conta && l.conta !== contaDoBanco)
    .map(l => ({ l: razaoInvertido ? { ...l, valor: -l.valor } : l, chave: chave(l.complemento || l.historico) }));
  // a mais usada em cada sentido (entrada / saída), para quando nada parece
  const maisUsada = (entrada: boolean) => {
    const conta: Record<string, { n: number; nome: string }> = {};
    for (const { l } of modelos) if ((l.valor > 0) === entrada) conta[l.conta!] = { n: (conta[l.conta!]?.n || 0) + 1, nome: l.historico };
    const melhor = Object.entries(conta).sort((a, b) => b[1].n - a[1].n)[0];
    return melhor ? { conta: melhor[0], nome: melhor[1].nome } : null;
  };
  const padrao = { entrada: maisUsada(true), saida: maisUsada(false) };
  const out: SugestaoDeLancamento[] = [];
  for (const p of pendentes) {
    if (!p.valor) continue;
    const entrada = p.valor > 0;
    const k = chave(p.historico);
    let melhor: { l: Lancamento; nota: number } | null = null;
    for (const m of modelos) {
      if ((m.l.valor > 0) !== entrada) continue;
      const nota = semelhanca(k, m.chave);
      if (!melhor || nota > melhor.nota) melhor = { l: m.l, nota };
    }
    const achou = melhor && melhor.nota >= PARECIDO_MINIMO ? melhor.l : null;
    const contra = achou ? { conta: achou.conta!, nome: achou.historico } : entrada ? padrao.entrada : padrao.saida;
    if (!contra) continue;
    // o histórico escrito primeiro (Vitor, 13/10/2026: "não use o histórico 0, priorize os escritos"): sem o "0" do
    // documento; sem nenhuma palavra, o texto do lançamento parecido do razão, ou o nome da conta
    const limpo = p.historico.split(/\s+/).filter(t => t && t !== '0').join(' ').trim();
    const escrito = (t: string | undefined) => !!t && /[a-zà-ú]{2,}/i.test(t);
    const historico = (escrito(limpo) ? limpo : escrito(achou?.complemento) ? achou!.complemento! : escrito(contra.nome) ? contra.nome : limpo || '(sem histórico)').slice(0, 250);
    out.push({
      linha: {
        automatico: '', data: dataBR(p.data), debito: entrada ? contaDoBanco : contra.conta, credito: entrada ? contra.conta : contaDoBanco,
        codHistorico: '', historico, valor: Math.abs(p.valor) / 100, documento: '',
      },
      conta: contra.conta, nomeDaConta: contra.nome, origem: achou ? 'padrao' : 'mais-usada',
      ...(achou ? { modelo: achou.complemento || achou.historico } : {}),
    });
  }
  return out;
}

/**
 * As sugestões para o que falta no razão de um banco (as pendências "Entrou/Saiu no banco e não está no razão"): os
 * modelos são todo o razão do banco já importado (quanto mais meses, mais padrões); o sentido do razão vem da conferência.
 */
export function lancamentosDoQueFaltaNoRazao(e: EmpresaExtrator, banco: string, primeiro: string, correcoes: readonly CorrecaoDoRazao[], contaDoBanco: string): SugestaoDeLancamento[] {
  const doLado = (lado: Lado): LancamentoDoArquivo[] => e.arquivos.filter(a => a.lado === lado && bancoDoArquivo(a, primeiro) === banco)
    .flatMap(a => a.lancamentos.map((l, i) => ({ ...l, id: a.id + ':' + i, idArquivo: a.id, lado })));
  const razao = doLado('sistema');
  const invertido = conferir(doLado('banco'), razao).sistemaInvertido;
  const faltas = correcoes.filter(c => c.tipo === 'falta' && c.noBanco).map(c => ({ data: c.data, valor: c.noBanco as number, historico: c.lancamento }));
  return lancamentosParaOSistema(faltas, razao, contaDoBanco, invertido);
}
