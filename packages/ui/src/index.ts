// @nads/ui — View compartilhada por todos os aplicativos do nads: o design-n1 em React.
// O CSS vem de '@nads/ui/estilo.css' (src/estilo/nads.css, cópia fiel do visual da Conferência).
export { Icone, DefsMarca, MarcaN, type NomeIcone } from './icones';
export { RetornoProvider, useRetorno, type Retorno, type OpcoesModal, type BotaoModal } from './retorno';
export { useTema, SeletorTema, type Tema } from './tema';
export { Alerta, MensagemFlutuante, CampoArquivo, CampoArquivos, Segmentado, Stat, Interruptor, SeletorMes, BotaoAcao, BotaoIcone, CampoData, useEstadoPorChave, MenuSuspenso, type ItemMenu } from './componentes';
export { Casca, baixarArquivo, baixarBytes, type SecaoCasca, type PaginaCasca } from './casca';
export { EscolherEmpresa, type EmpresaNaLista, type PropsEscolherEmpresa } from './escolherEmpresa';
export { LOGOS_BANDEIRAS } from './logosBandeiras';
export { BarraDeCarregamento, useCarregando } from './carregamento';
export { origemConfiavel, origemDoPai, useAlturaNaEtapa, useFerramentaNaEtapa } from './etapa';
export { LogoBanco, LogoDrive, LogoGmail, LogoWhatsApp, preCarregarLogosDosApps, urlDoLogoBanco, urlDoLogoNilma } from './logos';
