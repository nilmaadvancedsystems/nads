// Ações sobre a empresa do Extrator (funções puras: empresa → empresa nova), como na Conferência.
// Importar (primeira vez, apenas novas ou sobrepor), excluir um arquivo e o que as telas leem.
import { normalizarTexto } from '../../../formatos';
import type { ArquivoImportado, ArquivoLido, EmpresaExtrator, Lado, LancamentoDoArquivo, Lancamento, ModoImportacao, RegistroAuditoria } from '../tipos';
import { dataBR } from './texto';

/**
 * A versão do leitor de extrato (Vitor, 14/10/2026: "corrija essas pendências em todas as empresas de todos os meses"): sobe
 * quando a leitura dos PDFs muda; o extrato que veio do Drive e foi lido por uma versão mais velha é relido sozinho
 * (useDriveDaLinha), com relerExtrato. 2 = o Detalhamento do Saldo do BNB fora e o histórico no lançamento mais perto;
 * 3 = o OCR melhor (216 dpi, preto e branco, a página como tabela) e o sinal conferido pelo saldo corrido; 4 = os "Últimos
 * Lançamentos" do Bradesco fora (19/10/2026); 5 = a data do Nubank com o ano em pedaço separado e o dia que o OCR leu com
 * letra ("O8FEV2026"; 20/10/2026); 6 = o Sicoob do SISBR com o valor e o C/D em linhas soltas, o "- R$" do Stone e o extrato
 * do mais novo para o mais velho (26/10/2026); 7 = o nome do Pix do Stone no lançamento dele (não no de cima) e o saldo de
 * abertura pela coluna Saldo, quando o extrato não imprime o saldo anterior (26/10/2026); 8 = o quadro do limite do BB (Custo
 * Efetivo Total, Valor total devido…) fora e o depósito bloqueado com o "*" solto fora (26/10/2026); 9 = a Dt. balancete
 * guardada no lançamento do BB "Consultas" que vai pela Dt. movimento (27/10/2026).
 */
export const VERSAO_DO_LEITOR = 9;

export function empresaNova(nome: string): EmpresaExtrator {
  return { nome, arquivos: [], auditoria: [] };
}

/** Garante os campos (dado antigo ou incompleto). */
export function normalizarEmpresa(e: Partial<EmpresaExtrator> & { nome: string }): EmpresaExtrator {
  return {
    nome: e.nome, arquivos: Array.isArray(e.arquivos) ? e.arquivos : [], auditoria: Array.isArray(e.auditoria) ? e.auditoria : [],
    ...(Array.isArray(e.bancos) && e.bancos.length ? { bancos: e.bancos } : {}),
    ...(Array.isArray(e.pedidos) && e.pedidos.length ? { pedidos: e.pedidos } : {}),
  };
}

/** Todos os lançamentos de um lado, com o endereço de cada um. */
export function lancamentosDe(e: EmpresaExtrator, lado: Lado): LancamentoDoArquivo[] {
  const r: LancamentoDoArquivo[] = [];
  for (const a of e.arquivos) {
    if (a.lado !== lado) continue;
    a.lancamentos.forEach((l, i) => r.push({ ...l, id: a.id + ':' + i, idArquivo: a.id, lado }));
  }
  return r;
}

/** Primeira e última data de uma lista ('aaaa-mm-dd'). */
export function periodo(l: { data: string }[]): { de: string; ate: string } | null {
  if (!l.length) return null;
  let de = l[0].data, ate = l[0].data;
  for (const x of l) { if (x.data < de) de = x.data; if (x.data > ate) ate = x.data; }
  return { de, ate };
}

export function rotuloPeriodo(p: { de: string; ate: string } | null): string {
  if (!p) return '—';
  return p.de === p.ate ? dataBR(p.de) : dataBR(p.de) + ' a ' + dataBR(p.ate);
}

/** Competências ('aaaa-mm') com lançamento, em ordem. */
export function competencias(e: EmpresaExtrator): string[] {
  const s = new Set<string>();
  for (const a of e.arquivos) for (const l of a.lancamentos) s.add(l.data.slice(0, 7));
  return [...s].sort();
}

/** Os arquivos lidos batem com o que já existe (mesmas datas ou mesmo nome)? Aí pergunta o modo. */
export function jaTemNoPeriodo(e: EmpresaExtrator, lado: Lado, lidos: ArquivoLido[]): number {
  const existentes = lancamentosDe(e, lado);
  let qtd = 0;
  for (const l of lidos) {
    const p = periodo(l.lancamentos);
    if (!p) continue;
    qtd += existentes.filter(x => x.data >= p.de && x.data <= p.ate).length;
    if (!qtd && e.arquivos.some(a => a.lado === lado && a.nome === l.nome)) qtd = 1;
  }
  return qtd;
}

const chaveComHistorico = (x: Lancamento) => x.data + '|' + x.valor + '|' + normalizarTexto(x.historico);
const chaveSemHistorico = (x: Lancamento) => x.data + '|' + x.valor;

/**
 * O que de `novos` ainda não existe em `velhos` (mesma data, valor e histórico). Conta repetições:
 * dois lançamentos iguais no arquivo e um guardado → entra um.
 * `semHistorico`: no extrato, a mesma data e o mesmo valor bastam — os PDFs de meses vizinhos levam a página da virada
 * nos dois, e o histórico do mesmo lançamento sai diferente em cada um (o nome do Pix vai para outro lançamento perto da
 * quebra de página). Vitor, 26/10/2026: o Stone da 183 tinha os lançamentos de 31/01 "duas vezes no extrato".
 */
export function soNovos(velhos: Lancamento[], novos: Lancamento[], semHistorico = false): Lancamento[] {
  const chave = semHistorico ? chaveSemHistorico : chaveComHistorico;
  const conta = new Map<string, number>();
  for (const x of velhos) conta.set(chave(x), (conta.get(chave(x)) || 0) + 1);
  return novos.filter(x => {
    const n = conta.get(chave(x)) || 0;
    if (n) { conta.set(chave(x), n - 1); return false; }
    return true;
  });
}

export interface ResultadoImportacao {
  empresa: EmpresaExtrator;
  gravados: number;
  jaExistiam: number;
  substituidos: number;
  arquivos: number;
}

/**
 * Importa os arquivos lidos (os que têm erro ou nenhum lançamento ficam de fora).
 * - primeira: grava tudo;
 * - novas: grava só o que ainda não existe no lado (soNovos), arquivo sem nada novo não entra;
 * - sobrepor: apaga o que existe nas datas dos arquivos novos e grava tudo.
 * `ids` dá o id de cada arquivo novo (quem chama decide: relógio, contador…).
 */
export function importar(e: EmpresaExtrator, lado: Lado, lidos: ArquivoLido[], modo: ModoImportacao | 'primeira', agora: Date, ids: () => string): ResultadoImportacao {
  const bons = lidos.filter(l => !l.erro && l.lancamentos.length);
  let arquivos = e.arquivos.slice();
  let substituidos = 0;
  if (modo === 'sobrepor') {
    const faixas = bons.map(l => periodo(l.lancamentos)!);
    const dentro = (d: string) => faixas.some(f => d >= f.de && d <= f.ate);
    arquivos = arquivos
      .map(a => {
        if (a.lado !== lado) return a;
        const fica = a.lancamentos.filter(x => !dentro(x.data));
        substituidos += a.lancamentos.length - fica.length;
        return fica.length === a.lancamentos.length ? a : { ...a, lancamentos: fica };
      })
      .filter(a => a.lancamentos.length);
  }
  let base: Lancamento[] = modo === 'novas' ? arquivos.filter(a => a.lado === lado).flatMap(a => a.lancamentos) : [];
  let gravados = 0, jaExistiam = 0, novosArquivos = 0;
  for (const l of bons) {
    let lanc = l.lancamentos;
    if (modo === 'novas') {
      const nv = soNovos(base, lanc, lado === 'banco');
      jaExistiam += lanc.length - nv.length;
      base = base.concat(nv);
      lanc = nv;
    }
    if (!lanc.length) continue;
    const a: ArquivoImportado = { id: ids(), lado, nome: l.nome, importadoEm: agora.toISOString(), modo, lancamentos: lanc, leitor: VERSAO_DO_LEITOR, ...(l.saldoAnterior != null ? { saldoAnterior: l.saldoAnterior } : {}), ...(l.saldosDoDia?.length ? { saldosDoDia: l.saldosDoDia } : {}) };
    arquivos.push(...caberNoBanco(a));
    gravados += lanc.length;
    novosArquivos++;
  }
  const detalhe = bons.map(l => l.nome).join(', ') + ' · ' + gravados + ' gravado(s)' +
    (jaExistiam ? ' · ' + jaExistiam + ' já existiam' : '') + (substituidos ? ' · ' + substituidos + ' substituído(s)' : '') +
    (modo === 'novas' ? ' · apenas novas' : modo === 'sobrepor' ? ' · sobreposto' : '');
  const reg: RegistroAuditoria = { ts: agora.toISOString(), acao: lado === 'banco' ? 'Importou extrato' : 'Importou lançamentos do sistema', detalhe, tom: 'ok' };
  return { empresa: { ...e, arquivos, auditoria: [reg, ...e.auditoria] }, gravados, jaExistiam, substituidos, arquivos: novosArquivos };
}

/** Os extratos do Drive lidos por um leitor mais velho (o PDF ou a imagem; o OFX e a planilha não mudam): para reler. */
export function extratosParaReler(e: EmpresaExtrator): ArquivoImportado[] {
  return e.arquivos.filter(a => a.lado === 'banco' && !!a.drive && (a.leitor ?? 1) < VERSAO_DO_LEITOR && /\.(pdf|jpe?g|png)$/i.test(a.drive.nome || a.nome));
}

/**
 * O mesmo lançamento guardado em dois extratos do mesmo banco (Vitor, 26/10/2026: o Stone da 183 tinha os de 31/01 no PDF
 * de janeiro e no de fevereiro — o de cada mês leva a página da virada — e "Aparece duas vezes no extrato"; no PDF, uma
 * vez só). Dia a dia: o dia fica com o arquivo que tem mais lançamentos nele (no empate, o importado primeiro); dos outros
 * saem os lançamentos daquele dia que ele também tem (mesma data e valor, contando as repetições: o rendimento de R$ 0,01
 * que o dia tem quatro vezes continua quatro). Rodar de novo não tira mais nada.
 * `bancoDe`: o banco de cada arquivo (bancoDoArquivo). Devolve quantos saíram (0 = nada a fazer).
 */
export function tirarSobreposicaoDosExtratos(e: EmpresaExtrator, bancoDe: (a: ArquivoImportado) => string, agora: Date): { empresa: EmpresaExtrator; tirados: number } {
  const porBanco = new Map<string, ArquivoImportado[]>();
  for (const a of e.arquivos) if (a.lado === 'banco') porBanco.set(bancoDe(a), [...(porBanco.get(bancoDe(a)) || []), a]);
  const novos = new Map<string, Lancamento[]>();
  let tirados = 0;
  for (const arqs of porBanco.values()) {
    if (arqs.length < 2) continue;
    // os arquivos de cada dia
    const dias = new Map<string, ArquivoImportado[]>();
    for (const a of arqs) for (const d of new Set(a.lancamentos.map(l => l.data))) dias.set(d, [...(dias.get(d) || []), a]);
    // o que sai de cada arquivo: 'arquivo' → os índices
    const sai = new Map<string, Set<number>>();
    for (const [d, doDia] of dias) {
      if (doDia.length < 2) continue;
      const qtd = (a: ArquivoImportado) => a.lancamentos.filter(l => l.data === d).length;
      const fica = doDia.reduce((m, a) => (qtd(a) > qtd(m) ? a : m));
      const tem = new Map<number, number>();
      for (const l of fica.lancamentos) if (l.data === d) tem.set(l.valor, (tem.get(l.valor) || 0) + 1);
      for (const a of doDia) {
        if (a === fica) continue;
        const resta = new Map(tem);
        a.lancamentos.forEach((l, i) => {
          if (l.data !== d || !(resta.get(l.valor) || 0)) return;
          resta.set(l.valor, (resta.get(l.valor) || 0) - 1);
          sai.set(a.id, (sai.get(a.id) || new Set()).add(i));
        });
      }
    }
    for (const a of arqs) {
      const s = sai.get(a.id);
      if (!s?.size) continue;
      novos.set(a.id, a.lancamentos.filter((_, i) => !s.has(i)));
      tirados += s.size;
    }
  }
  // o lançamento do BB "Consultas" que foi pela Dt. movimento e que outro extrato do mesmo banco já traz na Dt. balancete
  // dele, com o mesmo valor: é o mesmo, do mês do balancete (Vitor, 27/10/2026: a devolução de juros de 30/04 que o PDF de
  // abril traz em 30/04 e o de maio, pela Dt. movimento, em 04/05 — "é do mês 04, também não entra")
  for (const arqs of porBanco.values()) {
    for (const a of arqs) {
      const atuais = novos.get(a.id) || a.lancamentos;
      const fica = atuais.filter(l => !(l.balancete && l.balancete.slice(0, 7) !== l.data.slice(0, 7) && arqs.some(b => b !== a
        && (novos.get(b.id) || b.lancamentos).some(m => m.data === l.balancete && m.valor === l.valor && !m.balancete))));
      if (fica.length !== atuais.length) { novos.set(a.id, fica); tirados += atuais.length - fica.length; }
    }
  }
  if (!tirados) return { empresa: e, tirados: 0 };
  const arquivos = e.arquivos.map(a => (novos.has(a.id) ? { ...a, lancamentos: novos.get(a.id) as Lancamento[] } : a)).filter(a => a.lancamentos.length);
  const reg: RegistroAuditoria = { ts: agora.toISOString(), acao: 'Tirou lançamentos repetidos entre extratos', detalhe: tirados + ' lançamento(s) que estavam em dois extratos do mesmo banco (a página da virada do mês)', tom: 'ok' };
  return { empresa: { ...e, arquivos, auditoria: [reg, ...e.auditoria] }, tirados };
}

/**
 * Os extratos importados do computador (ou do e-mail) lidos por um leitor mais velho (Vitor, 26/10/2026: o Stone da 183
 * continuava com o sinal errado depois do leitor novo): o arquivo não fica guardado, então quem relê busca o PDF do mês
 * no Drive (useDriveDaLinha) e só troca quando ele cobre todos os meses do importado.
 */
export function extratosParaRelerPeloDrive(e: EmpresaExtrator): ArquivoImportado[] {
  return e.arquivos.filter(a => a.lado === 'banco' && !a.drive && (a.leitor ?? 1) < VERSAO_DO_LEITOR && a.lancamentos.length > 0 && /\.(pdf|jpe?g|png)$/i.test(a.nome));
}

/**
 * A leitura nova cobre os meses do arquivo? (senão, trocar perderia um mês) O mês com 1 ou 2 lançamentos pode faltar: é o
 * erro do leitor velho que a leitura nova conserta (o "27/07/2026" do cabeçalho do Sicoob do SISBR que virava lançamento
 * com o saldo anterior); os meses com 3 ou mais têm de estar todos.
 */
export function leituraCobreOArquivo(a: ArquivoImportado, lido: ArquivoLido): boolean {
  if (lido.erro || !lido.lancamentos.length) return false;
  const lidos = new Set(lido.lancamentos.map(l => l.data.slice(0, 7)));
  const porMes = new Map<string, number>();
  for (const l of a.lancamentos) porMes.set(l.data.slice(0, 7), (porMes.get(l.data.slice(0, 7)) || 0) + 1);
  return [...porMes].every(([m, n]) => n < 3 || lidos.has(m)) && [...porMes.keys()].some(m => lidos.has(m));
}

/**
 * Troca os lançamentos do arquivo pelos da leitura nova (o mesmo arquivo, os mesmos meses dele; o que outro arquivo do
 * lado já tem não entra de novo) e marca a versão do leitor. Fica no histórico. Sem lançamentos na leitura nova, só marca.
 */
export function relerExtrato(e: EmpresaExtrator, arquivoId: string, lido: ArquivoLido, agora: Date): EmpresaExtrator {
  const a = e.arquivos.find(x => x.id === arquivoId);
  if (!a) return e;
  const meses = new Set(a.lancamentos.map(l => l.data.slice(0, 7)));
  const outros = e.arquivos.filter(x => x.id !== arquivoId && x.lado === a.lado && (x.banco || '') === (a.banco || '')).flatMap(x => x.lancamentos);
  const novos = lido.erro ? [] : soNovos(outros, lido.lancamentos.filter(l => !meses.size || meses.has(l.data.slice(0, 7))));
  if (!novos.length) return { ...e, arquivos: e.arquivos.map(x => (x.id === arquivoId ? { ...x, leitor: VERSAO_DO_LEITOR } : x)) };
  // o pedaço de um arquivo cortado por mês (excluirMesesDoArquivo): o saldo anterior é o do PDF mais os meses de antes dele
  const primeiro = [...meses].sort()[0];
  const antes = primeiro ? lido.lancamentos.filter(l => l.data < primeiro).reduce((t, l) => t + l.valor, 0) : 0;
  const saldosDoDia = lido.saldosDoDia?.filter(s => !meses.size || meses.has(s.data.slice(0, 7)));
  const novo: ArquivoImportado = {
    ...a, lancamentos: novos, leitor: VERSAO_DO_LEITOR,
    ...(lido.saldoAnterior != null ? { saldoAnterior: lido.saldoAnterior + antes } : {}), ...(saldosDoDia?.length ? { saldosDoDia } : {}),
  };
  const reg: RegistroAuditoria = { ts: agora.toISOString(), acao: 'Releu o extrato', detalhe: a.nome + ' · ' + a.lancamentos.length + ' → ' + novos.length + ' lançamento(s), com o leitor novo', tom: 'ok' };
  return { ...e, arquivos: e.arquivos.map(x => (x.id === arquivoId ? novo : x)), auditoria: [reg, ...e.auditoria] };
}

export function excluirArquivo(e: EmpresaExtrator, id: string, agora: Date): EmpresaExtrator {
  const a = e.arquivos.find(x => x.id === id);
  if (!a) return e;
  const reg: RegistroAuditoria = {
    ts: agora.toISOString(), acao: 'Excluiu arquivo', tom: 'bad',
    detalhe: (a.lado === 'banco' ? 'Extrato: ' : 'Sistema: ') + a.nome + ' · ' + a.lancamentos.length + ' lançamento(s)',
  };
  return { ...e, arquivos: e.arquivos.filter(x => x.id !== id), auditoria: [reg, ...e.auditoria] };
}

/**
 * O arquivo cortado em um por mês (como o PDF que sobe para o Drive), cada um com o saldo anterior dele (o do arquivo mais
 * os lançamentos dos meses de antes) e os saldos do dia dele. O de um mês só volta como está.
 */
export function pedacosPorMes(a: ArquivoImportado): ArquivoImportado[] {
  const meses = [...new Set(a.lancamentos.map(l => l.data.slice(0, 7)))].sort();
  if (meses.length <= 1) return [a];
  return meses.map(m => {
    const lancamentos = a.lancamentos.filter(l => l.data.startsWith(m));
    const antes = a.lancamentos.filter(l => l.data < m).reduce((t, l) => t + l.valor, 0);
    const saldosDoDia = a.saldosDoDia?.filter(s => s.data.startsWith(m));
    return {
      ...a, id: a.id + '|' + m, lancamentos,
      ...(a.saldoAnterior != null ? { saldoAnterior: a.saldoAnterior + antes } : {}),
      ...(a.saldosDoDia ? { saldosDoDia: saldosDoDia || [] } : {}),
    };
  });
}

/**
 * O tamanho de um arquivo importado no banco não pode passar de 1 MB (o limite do documento do Firestore): o razão grande
 * (Vitor, 26/10/2026: o do BB da 237, 6.891 lançamentos, 1,2 MB) não gravava — a tela mostrava, e ele sumia depois de
 * uns minutos ou ao trocar de aba. Acima disto, o arquivo é guardado cortado por mês; o mês que ainda passa (30/10/2026:
 * o de um posto com milhares de lançamentos no mês) é cortado em dias seguidos, cada pedaço com o saldo anterior dele.
 */
export const TAMANHO_PARA_CORTAR = 700_000;
/** O tamanho no banco: os bytes do JSON em UTF-8 (o acento conta 2). */
export const bytesNoBanco = (v: unknown) => new TextEncoder().encode(JSON.stringify(v)).length;
const tamanho = (a: ArquivoImportado) => bytesNoBanco(a);

/**
 * O pedaço de um mês ainda grande demais, cortado em dias seguidos que caibam (os lançamentos de cada dia na ordem do
 * arquivo; o dia sozinho grande demais, em partes). Cada pedaço leva o saldo anterior dele (o do mês mais os lançamentos
 * dos pedaços de antes) e os saldos dos dias dele. O que cabe volta como está.
 */
function cortarPorDias(p: ArquivoImportado): ArquivoImportado[] {
  if (tamanho(p) <= TAMANHO_PARA_CORTAR) return [p];
  const fixo = tamanho({ ...p, lancamentos: [] });
  const cabe = Math.max(1, TAMANHO_PARA_CORTAR - fixo);
  const peso = (l: Lancamento) => bytesNoBanco(l) + 1;
  // os blocos: um por dia; o dia que sozinho não cabe, em partes
  const blocos: Lancamento[][] = [];
  for (const dia of [...new Set(p.lancamentos.map(l => l.data))].sort()) {
    let bloco: Lancamento[] = [], soma = 0;
    for (const l of p.lancamentos.filter(x => x.data === dia)) {
      if (bloco.length && soma + peso(l) > cabe) { blocos.push(bloco); bloco = []; soma = 0; }
      bloco.push(l); soma += peso(l);
    }
    if (bloco.length) blocos.push(bloco);
  }
  // os pedaços: os blocos seguidos enquanto cabem
  const grupos: Lancamento[][] = [];
  let atual: Lancamento[] = [], soma = 0;
  for (const b of blocos) {
    const pb = b.reduce((t, l) => t + peso(l), 0);
    if (atual.length && soma + pb > cabe) { grupos.push(atual); atual = []; soma = 0; }
    atual = atual.concat(b); soma += pb;
  }
  if (atual.length) grupos.push(atual);
  // o saldo do dia vai no último pedaço que tem o dia
  const ultimoDoDia = new Map<string, number>();
  grupos.forEach((g, k) => { for (const l of g) ultimoDoDia.set(l.data, k); });
  let antes = 0;
  return grupos.map((lancamentos, k) => {
    const saldosDoDia = p.saldosDoDia?.filter(s => ultimoDoDia.get(s.data) === k);
    const pedaco: ArquivoImportado = {
      ...p, id: p.id + '|' + (k + 1), lancamentos,
      ...(p.saldoAnterior != null ? { saldoAnterior: p.saldoAnterior + antes } : {}),
      ...(p.saldosDoDia ? { saldosDoDia: saldosDoDia || [] } : {}),
    };
    antes += lancamentos.reduce((t, l) => t + l.valor, 0);
    return pedaco;
  });
}

/**
 * O arquivo, ou os pedaços dele quando ele é grande demais para um documento do banco: por mês e, o mês que ainda não
 * cabe, em dias seguidos (cortarPorDias). Cada pedaço fica abaixo de TAMANHO_PARA_CORTAR.
 */
export function caberNoBanco(a: ArquivoImportado): ArquivoImportado[] {
  return tamanho(a) > TAMANHO_PARA_CORTAR ? pedacosPorMes(a).flatMap(cortarPorDias) : [a];
}

/**
 * Tira só os meses escolhidos do arquivo, no extrato e no razão (Vitor, 21/10/2026: "tem vezes que o cliente manda os
 * extratos quebrados… deixa eu conseguir excluir apenas o mês que selecionei, ao invés de excluir tudo"). O arquivo de
 * vários meses é cortado em um por mês (como o PDF que sobe para o Drive), cada um com o saldo anterior dele (o do arquivo
 * mais os lançamentos dos meses de antes) e os saldos do dia dele; os meses escolhidos saem. Sem mês que fique, sai tudo.
 */
export function excluirMesesDoArquivo(e: EmpresaExtrator, id: string, meses: readonly string[], agora: Date): EmpresaExtrator {
  const a = e.arquivos.find(x => x.id === id);
  if (!a) return e;
  const tirar = new Set(meses);
  const doArquivo = [...new Set(a.lancamentos.map(l => l.data.slice(0, 7)))].sort();
  const ficam = doArquivo.filter(m => !tirar.has(m));
  if (!ficam.length) return excluirArquivo(e, id, agora);
  const saem = doArquivo.filter(m => tirar.has(m));
  if (!saem.length) return e;
  const pedacos = pedacosPorMes(a).filter(x => ficam.includes(x.lancamentos[0].data.slice(0, 7)));
  const rot = (m: string) => m.slice(5) + '/' + m.slice(0, 4);
  const qtd = a.lancamentos.filter(l => tirar.has(l.data.slice(0, 7))).length;
  const reg: RegistroAuditoria = {
    ts: agora.toISOString(), acao: 'Excluiu o mês do arquivo', tom: 'bad',
    detalhe: (a.lado === 'banco' ? 'Extrato: ' : 'Sistema: ') + a.nome + ' · ' + saem.map(rot).join(', ') + ' · ' + qtd + ' lançamento(s); ficam ' + ficam.map(rot).join(', '),
  };
  const i = e.arquivos.findIndex(x => x.id === id);
  return { ...e, arquivos: [...e.arquivos.slice(0, i), ...pedacos, ...e.arquivos.slice(i + 1)], auditoria: [reg, ...e.auditoria] };
}

/** Auditoria, mais novo primeiro. */
export function linhasAuditoria(e: EmpresaExtrator): RegistroAuditoria[] {
  return e.auditoria.slice().sort((a, b) => b.ts.localeCompare(a.ts));
}
