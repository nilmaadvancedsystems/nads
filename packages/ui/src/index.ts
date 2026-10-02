// @nads/ui — View compartilhada por todos os aplicativos do nads: o design-n1 em React.
// O CSS vem de '@nads/ui/estilo.css' (src/estilo/nads.css, cópia fiel do visual da Conferência).
export { Icone, DefsMarca, MarcaN, type NomeIcone } from './icones';
export { RetornoProvider, useRetorno, type Retorno, type OpcoesModal, type BotaoModal } from './retorno';
export { useTema, SeletorTema, type Tema } from './tema';
export { Alerta, Esqueleto, NumeroQueConta, MensagemFlutuante, CampoArquivo, CampoArquivos, Segmentado, Stat, Interruptor, SeletorMes, BotaoAcao, BotaoIcone, CampoData, useEstadoPorChave, MenuSuspenso, type ItemMenu } from './componentes';
export { Casca, baixarArquivo, baixarBytes, type SecaoCasca, type PaginaCasca } from './casca';
export { EscolherEmpresa, type EmpresaNaLista, type PropsEscolherEmpresa } from './escolherEmpresa';
export { LOGOS_BANDEIRAS } from './logosBandeiras';
export { BarraDeCarregamento, useCarregando } from './carregamento';
export { MOLA, MOLA_VIVA, semMovimento, useEntradaAnimada, useLinhasQueSeMovem, useIndicador, useNumeroAnimado, lerNumero, contar, desenharCheck, revelarTitulo, encerrarPaginas, moverIndicador, marcarOrigem, pegarOrigem, origemDe, crescerDaOrigem, voltarParaOrigem, apagarFundo, type Origem, type FormaDoIndicador, animar, entrar, sairComo, afundar, voltar, definirJeito, jeitoAtual, JEITOS, ENTRAR, MOVER, GAVETA, SUAVE, type Jeito, type Peca } from './animacao';
export { iniciarAnimador } from './animador';
export { atualizarVersao, useVersaoNova, TravaDeVersaoNova } from './versaoNova';
export { iniciarContinuidade, atualizarSemPerder } from './continuidade';
export { origemConfiavel, origemDoPai, useAbasParaAEtapa, useAlturaNaEtapa, useFerramentaNaEtapa, type AbaDaEtapa } from './etapa';
export { LogoBanco, LogoDrive, LogoGmail, LogoWhatsApp, preCarregarLogosDosApps, urlDoLogoBanco, urlDoLogoNilma } from './logos';
export { AberturaN } from './abertura';
