// O extrato da conta na pasta da empresa no Drive do escritório (pasta do ano, "2026 › <código> - <RAZÃO
// SOCIAL> › …"): o mesmo mapa que o robô do Entregas mantém (ver creditor/regras/drive.ts). Procura em
// tudo o que está dentro da pasta da empresa um arquivo de extrato (PDF, OFX, planilha) da competência e,
// quando dá, do banco e da conta certos. Um só bom → achou; senão a pessoa escolhe entre os candidatos.
import { nomeNorm } from '../../../formatos';
import type { ArquivoAchado, BuscaNoDrive, ItemDrive } from '../../creditor/regras/drive';
import { falaDaCompetencia } from '../../creditor/regras/drive';

const EXTENSOES = /\.(pdf|ofx|xlsx?|csv|txt)$/i;

/**
 * Como cada banco aparece nos nomes das pastas e dos arquivos (a pasta do banco em BANCÁRIOS: "BNB", "SICOOB"…).
 * Com o banco da conta conhecido, o arquivo de OUTRO banco nem entra na conta (Vitor, 05/10/2026: a empresa 58, com BNB e
 * Sicoob, mostrava os extratos dos dois bancos e de todos os meses).
 */
const APELIDOS: Record<string, string[]> = {
  bnb: ['bnb', 'banco do nordeste', 'nordeste'], 'banco-do-brasil': ['banco do brasil', 'bb'], caixa: ['caixa', 'cef'],
  itau: ['itau'], bradesco: ['bradesco'], santander: ['santander'], sicoob: ['sicoob'], sicredi: ['sicredi'], inter: ['inter'],
  nubank: ['nubank'], btg: ['btg'], c6: ['c6'], cora: ['cora'], 'mercado-pago': ['mercado pago'], pagbank: ['pagbank', 'pagseguro'],
  safra: ['safra'], stone: ['stone'], banrisul: ['banrisul'], cresol: ['cresol'],
};
const temPalavra = (texto: string, p: string) => (' ' + texto + ' ').includes(' ' + p + ' ');

/** A conta que se procura: o nome e a marca do banco, e o número da conta (se tiver). */
export interface ContaProcurada { nome: string; marca?: string; conta?: string }

export function acharExtratoNoDrive(itens: readonly ItemDrive[], raizDoCliente: string | null, competencia: string, conta: ContaProcurada): BuscaNoDrive {
  if (!raizDoCliente) return { situacao: 'sem-cliente', arquivo: null, candidatos: [] };
  const filhos = new Map<string, ItemDrive[]>();
  for (const it of itens) filhos.set(it.p, [...(filhos.get(it.p) || []), it]);
  const banco = [conta.nome, conta.marca].filter((v): v is string => !!v && v !== 'banco').map(v => nomeNorm(v.replace(/-/g, ' ')))
    .filter(v => v && v !== 'banco');
  // o banco da conta pelos apelidos (a marca, ou o nome que bate com um banco conhecido)
  const meu = Object.keys(APELIDOS).find(id => id === conta.marca || APELIDOS[id].some(a => banco.some(b => temPalavra(b, a))));
  const meus = meu ? APELIDOS[meu] : [];
  const outros = Object.entries(APELIDOS).filter(([id]) => id !== meu).flatMap(([, a]) => a);
  const digitos = (conta.conta || '').replace(/\D/g, '');

  type Nota = ArquivoAchado & { nota: number };
  const achados: Nota[] = [];
  const andar = (pasta: string, caminho: string[]) => {
    for (const it of filhos.get(pasta) || []) {
      if (it.t === 'd') { andar(it.i, [...caminho, it.n]); continue; }
      if (it.t !== 'f' || !EXTENSOES.test(it.n)) continue;
      const texto = nomeNorm([...caminho, it.n].join(' '));
      if (/cred ?liquid|razao|balancete/.test(texto)) continue; // não é extrato
      // a rotina de arquivamento guarda extrato, comprovante e aplicação em pastas separadas
      // (CONTÁBIL/EXTRATOS/AAAA/MM/{BANCÁRIOS|COMPROVANTES|APLICAÇÕES}): comprovante não é extrato
      const pastas = caminho.map(nomeNorm);
      if (pastas.some(p => p === 'comprovantes' || p === 'aplicacoes') || /^comprovante/.test(nomeNorm(it.n))) continue;
      // de outro banco (com o banco da conta conhecido): não é este extrato
      if (meu && !meus.some(a => temPalavra(texto, a)) && outros.some(a => temPalavra(texto, a))) continue;
      const daCompetencia = falaDaCompetencia([...caminho, it.n].join(' '), competencia);
      const nota = (daCompetencia ? 4 : 0) + (/extrato/.test(texto) ? 2 : 0) + (pastas.includes('bancarios') ? 3 : 0)
        + (banco.some(b => b && texto.includes(b)) || meus.some(a => temPalavra(texto, a)) ? 2 : 0) + (digitos.length >= 4 && texto.replace(/\D/g, '').includes(digitos) ? 3 : 0);
      achados.push({ id: it.i, nome: it.n, caminho: [...caminho, it.n].join(' › '), modificado: it.m, credliquidacao: false, daCompetencia, nota });
    }
  };
  andar(raizDoCliente, []);

  const ordem = (a: Nota, b: Nota) => b.nota - a.nota || (b.modificado || '').localeCompare(a.modificado || '');
  const bons = achados.filter(a => a.daCompetencia && a.nota >= 6).sort(ordem);
  const semNota = (a: Nota): ArquivoAchado => ({ id: a.id, nome: a.nome, caminho: a.caminho, modificado: a.modificado, credliquidacao: false, daCompetencia: a.daCompetencia });
  // para escolher: só os do mês, quando tem algum do mês (os outros meses não servem)
  const doMes = achados.filter(a => a.daCompetencia);
  const candidatos = (doMes.length ? doMes : achados).sort(ordem).map(semNota);
  if (bons.length === 1 || (bons.length > 1 && bons[0].nota > bons[1].nota)) return { situacao: 'achou', arquivo: semNota(bons[0]), candidatos };
  if (bons.length > 1) return { situacao: 'varios', arquivo: null, candidatos };
  return { situacao: 'nada', arquivo: null, candidatos };
}

/** A frase da tela para cada situação da busca do extrato. */
export function mensagemDaBuscaDoExtrato(b: BuscaNoDrive, mes: string): string {
  switch (b.situacao) {
    case 'sem-cliente': return 'A empresa não tem pasta no Drive de 2026 (a pasta precisa de "<código> - <nome>").';
    case 'sem-pasta': return 'Não achei a pasta da empresa no Drive.';
    case 'nada': return 'Não achei o extrato de ' + mes + ' na pasta da empresa' + (b.candidatos.length ? ': escolha um dos arquivos.' : '. Importe à mão.');
    case 'varios': return 'Achei mais de um extrato de ' + mes + ': escolha qual usar.';
    case 'achou': return 'Achei ' + (b.arquivo?.caminho || '') + '.';
  }
}
