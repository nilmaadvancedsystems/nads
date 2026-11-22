#!/usr/bin/env node
// A DANFSe no robô (15/10/2026: a NFS-e autorizada por e-mail ao cliente). O robô (robo/, CommonJS, roda na VM) precisa do
// mesmo PDF que o botão "Baixar DANFSe" do nads desenha — sem copiar o desenho. Este script junta num arquivo só, em
// CommonJS, o que já existe: o core (nfse.dadosDaDanfse e o texto do e-mail) e o desenharDanfse de danfsePdf.ts, com o
// pdf-lib e o qrcode dentro. Sai em robo/gerado/danfse.js, que vai para o repositório (a VM só faz git pull).
//
// O empacotador é o rolldown que já vem com o Vite 8 (o Vite 8 não usa mais o esbuild; não há dependência nova).
//
//   node scripts/robo-danfse.mjs              gera de novo
//   node scripts/robo-danfse.mjs --conferir   só confere (o npm run verificar chama): falha se o gerado ficou velho
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rolldown } from 'rolldown';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SAIDA = path.join(raiz, 'robo', 'gerado', 'danfse.js');
const ENTRADA = '\0danfse-do-robo';
const caminho = rel => JSON.stringify(path.join(raiz, rel).split(path.sep).join('/'));

// o que o robô usa: o PDF (bytes) a partir do XML da nota, os dados da DANFSe e o texto do e-mail
const codigo = [
  'import { dadosDaDanfse } from ' + caminho('packages/core/src/nfse/danfse.ts') + ';',
  'import { camposDaNota, configDoEmail, emailValido, mensagemDaNota, EMAIL_PADRAO, AVISO_SEM_VALOR } from ' + caminho('packages/core/src/nfse/email.ts') + ';',
  'import { desenharDanfse } from ' + caminho('apps/web/src/aplicativos/tarefas/telas/financeiro/danfsePdf.ts') + ';',
  // a DANFE da NF-e/NFC-e (09/11/2026: os PDFs do SIEG, robo/sieg-pdfs.js)
  'export { danfeDoXml } from ' + caminho('packages/core/src/tarefas/sieg/danfe.ts') + ';',
  'export { desenharDanfe } from ' + caminho('apps/web/src/aplicativos/tarefas/telas/fiscal/partes/danfePdf.ts') + ';',
  // o Registro da Área do Cliente (12/11/2026, robo/area-cliente.js): os funcionários pelas guias do FGTS (o texto do PDF
  // com a posição, pelo pdf.js do próprio robô) e o que é cada documento do DP
  'export { registroDasGuias, categoriaDoArquivoDp, ehDoDp, donoDoArquivo, mascararCpf } from ' + caminho('packages/core/src/areaCliente/pessoal.ts') + ';',
  'export { historicoDaFolha } from ' + caminho('packages/core/src/areaCliente/dp.ts') + ';',
  // a folha de verdade (13/11/2026): os holerites e a previsão de férias dos PDFs do DP
  'export { holeritesDasPaginas, feriasDasPaginas, registroComAFolha, historicoComAFolha } from ' + caminho('packages/core/src/areaCliente/folhaLida.ts') + ';',
  'export { guiasDoFgtsDasLinhas, linhasDaGuiaDoFgts } from ' + caminho('packages/core/src/tarefas/regras/fgts.ts') + ';',
  // o Faturamento da Área do Cliente (12/11/2026): os 12 meses de cada empresa pelas notas emitidas no SIEG
  'export { faturamentoDoCliente, competenciasDoFaturamento, entradasDosExtratos, comOBanco, lancamentosDoMes } from ' + caminho('packages/core/src/areaCliente/faturamento.ts') + ';',
  'export { notasDoMes, listaDeNotasDoMes } from ' + caminho('packages/core/src/areaCliente/notasDoMes.ts') + ';',
  'export { erroDaLogo } from ' + caminho('packages/core/src/areaCliente/logo.ts') + ';',
  'export { chaveDoPedidoDeDanfe, idDaDanfe, partesDaChave } from ' + caminho('packages/core/src/areaCliente/pedidoDeDanfe.ts') + ';',
  // os vencimentos da agenda do cliente com os feriados (17/11/2026, ficha E01 do plano do Acessórias): o robô faz a mesma
  // conta do site pelo calendário único, em vez de uma cópia (robo/area-cliente-regras.js)
  // o certificado A1 do cofre na Área do Cliente (17/11/2026, ficha certificado-digital)
  'export { certificadoDoLink } from ' + caminho('packages/core/src/areaCliente/certificado.ts') + ';',
  // o que falta mandar e os pedidos do Mandei no sino da Área do Cliente (17/11/2026)
  'export { pendenciasDoMes, competenciaDoEnvio, documentoDoEnvio } from ' + caminho('packages/core/src/areaCliente/pendencias.ts') + ';',
  // o registro de abertura da guia (17/11/2026, ficha comprovante-de-leitura)
  // o lembrete de vencimento ao cliente (17/11/2026, ficha lembrete-de-vencimento)
  'export { guiasParaLembrar, emailDoLembrete, diasDoLembrete, lembreteDaEmpresa } from ' + caminho('packages/core/src/areaCliente/lembretes.ts') + ';',
  // o e-mail quando o escritório responde (17/11/2026, ficha aviso-de-resposta)
  // o acervo de documentos do escritório (17/11/2026, ficha documentos-do-escritorio)
  'export { areaDaSubpasta, idDoDocumentoDoEscritorio, PASTA_DO_ESCRITORIO } from ' + caminho('packages/core/src/areaCliente/documentosDoEscritorio.ts') + ';',
  // a ficha cadastral da empresa (18/11/2026, ficha dados-cadastrais)
  // as certidões da empresa (18/11/2026, ficha certidoes)
  // a senha por pessoa na Área do Cliente (18/11/2026)
  'export { permissoesPorEmail, mesmasPermissoes, normalizarEmail, clienteAbreOLink } from ' + caminho('packages/core/src/areaCliente/acessoPorPessoa.ts') + ';',
  // o e-mail de senha pelo robô (19/11/2026)
  'export { pedidoDeSenha, linkDaPaginaDeSenha, emailDeSenha } from ' + caminho('packages/core/src/areaCliente/emailDeSenha.ts') + ';',
  // a Tela de Insights (18/11/2026, ficha tela-de-insights)
  'export { rotinasPorPessoa, situacaoDoClienteDp, contarDp, contarChamados, contarEntregas, delegadasAtrasadas, fiscalPorPessoa, setorDoUsuario, empresasDoTabelaoFiscal, empresasDoInsight } from ' + caminho('packages/core/src/tarefas/regras/insights.ts') + ';',
  // o tabelão do Fiscal, para o Insights (19/11/2026)
  'export { situacaoDaLinha } from ' + caminho('packages/core/src/tarefas/regras/controleDeTributos.ts') + ';',
  'export { competenciaDeTrabalhoDoDp } from ' + caminho('packages/core/src/tarefas/regras/prazosDoDp.ts') + ';',
  'export { rotinaDaEmpresa } from ' + caminho('packages/core/src/tarefas/rotinas/rotinaDo.ts') + ';',
  'export { CLIENTES_DO_DP, clienteDoDpNoCadastro } from ' + caminho('packages/core/src/empresas/dp.ts') + ';',
  'export { situacaoDoTicket } from ' + caminho('packages/core/src/mandei/index.ts') + ';',
  // os parcelamentos na Área (18/11/2026, ficha parcelamentos)
  'export { parcelamentosDoCliente } from ' + caminho('packages/core/src/areaCliente/parcelamentos.ts') + ';',
  'export { parcelamentoDoDocumento } from ' + caminho('packages/core/src/entregas/parcelamentos.ts') + ';',
  // a guia paga pelo extrato (18/11/2026, ficha guia-paga-confirmada)
  'export { guiasPagasPeloExtrato, saidasDosMeses } from ' + caminho('packages/core/src/areaCliente/guiaPaga.ts') + ';',
  // a avaliação do atendimento (18/11/2026, ficha avaliacao-do-atendimento)
  'export { avaliacaoDoPedido } from ' + caminho('packages/core/src/areaCliente/avaliacao.ts') + ';',
  // o comprovante ligado à guia (18/11/2026, ficha comprovante-da-guia, parte B)
  'export { guiaDoComprovante, rotuloDoComprovante } from ' + caminho('packages/core/src/areaCliente/comprovanteDaGuia.ts') + ';',
  // o cliente confirma a entrega pela Área (18/11/2026, ficha confirmar-entrega)
  'export { entregaDoPedidoDeRecebido, entregasParaConfirmar } from ' + caminho('packages/core/src/areaCliente/entregaRecebida.ts') + ';',
  // "Não tive movimento" pela Área do Cliente (22/11/2026, Documentos do cliente)
  'export { competenciaDoPedidoDeSemMovimento, competenciaAceitaNoSemMovimento } from ' + caminho('packages/core/src/areaCliente/semMovimento.ts') + ';',
  'export { recusaLida } from ' + caminho('packages/core/src/areaCliente/recusa.ts') + ';',
  'export { comunicadosDoLink, lerComunicado } from ' + caminho('packages/core/src/areaCliente/comunicados.ts') + ';',
  // o documento vencendo vira tarefa (22/11/2026, ficha M03): a tarefa no formato das delegadas e quem é a pessoa pelo nome
  'export { tarefaDoPapel, papelViraTarefaHoje, idDaTarefaDoPapel } from ' + caminho('packages/core/src/tarefas/regras/papelViraTarefa.ts') + ';',
  'export { pessoasDaTarefa } from ' + caminho('packages/core/src/tarefas/regras/delegadas.ts') + ';',
  'export { chaveDoNome } from ' + caminho('packages/core/src/tarefas/regras/insights.ts') + ';',
  // o aviso de acesso novo e o "Não fui eu" (22/11/2026, ficha E21)
  'export { textoDoAvisoDeAcesso, textoDoAlertaNaoFuiEu } from ' + caminho('packages/core/src/usuarios/regras/liberacao.ts') + ';',
  'export { orgaoDaCertidao, ultimaPorOrgao } from ' + caminho('packages/core/src/areaCliente/certidoes.ts') + ';',
  'export { fichaDoCliente } from ' + caminho('packages/core/src/areaCliente/ficha.ts') + ';',
  'export { precisaAvisar, emailDoAviso } from ' + caminho('packages/core/src/areaCliente/avisoDeResposta.ts') + ';',
  'export { guiaDoPedidoDeLeitura, idDaLeitura } from ' + caminho('packages/core/src/areaCliente/leitura.ts') + ';',
  'export { ticketsDaArea } from ' + caminho('packages/core/src/mandei/index.ts') + ';',
  'export { VENCIMENTOS, vencimentoNaCompetencia } from ' + caminho('packages/core/src/areaCliente/vencimentos.ts') + ';',
  'export { itensDoPdf } from ' + caminho('packages/core/src/extratudo/extrator/arquivos/pdf.ts') + ';',
  'export { dadosDaDanfse, desenharDanfse, camposDaNota, configDoEmail, emailValido, mensagemDaNota, EMAIL_PADRAO, AVISO_SEM_VALOR };',
  '/** O PDF da DANFSe (Uint8Array) a partir do XML da NFS-e autorizada. */',
  'export async function pdfDaDanfse(xml, municipios) { return desenharDanfse(dadosDaDanfse(xml, municipios)); }',
].join('\n');

const AVISO = [
  '// GERADO — NÃO EDITE. Feito por scripts/robo-danfse.mjs a partir de packages/core/src/nfse/{danfse,email}.ts e',
  '// apps/web/src/aplicativos/tarefas/telas/financeiro/danfsePdf.ts (com o pdf-lib e o qrcode dentro).',
  '// Mudou alguma dessas fontes? Rode `node scripts/robo-danfse.mjs` e commite este arquivo junto.',
  '',
].join('\n');

async function gerar() {
  const pacote = await rolldown({
    input: ENTRADA,
    // 'browser': o qrcode sem o pngjs/fs (só o create, puro); o que sai não usa nada do navegador e roda no Node
    platform: 'browser',
    logLevel: 'warn',
    // o pdf.js fica de fora: o robô tem o dele (robo/node_modules), carregado só quando lê um PDF
    external: [/^pdfjs-dist/],
    plugins: [{ name: 'entrada-do-robo', resolveId: id => (id === ENTRADA ? id : null), load: id => (id === ENTRADA ? codigo : null) }],
  });
  const { output } = await pacote.generate({ format: 'cjs', codeSplitting: false, minify: true, comments: false });
  await pacote.close();
  if (output.length !== 1) throw new Error('o pacote saiu em ' + output.length + ' arquivos (esperava 1)');
  return AVISO + output[0].code.replace(/\r\n/g, '\n');
}

const conteudo = await gerar();
if (process.argv.includes('--conferir')) {
  let atual = '';
  try { atual = readFileSync(SAIDA, 'utf8').replace(/\r\n/g, '\n'); } catch { /* não existe: velho */ }
  if (atual !== conteudo) {
    console.error('robo/gerado/danfse.js está velho em relação ao core e ao danfsePdf.ts: rode `node scripts/robo-danfse.mjs` e commite.');
    process.exit(1);
  }
  console.log('robo/gerado/danfse.js em dia.');
} else {
  mkdirSync(path.dirname(SAIDA), { recursive: true });
  writeFileSync(SAIDA, conteudo);
  console.log('robo/gerado/danfse.js gerado (' + Math.round(conteudo.length / 1024) + ' KB).');
}
