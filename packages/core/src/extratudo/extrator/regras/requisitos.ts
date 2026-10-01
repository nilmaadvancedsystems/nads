// Os requisitos para seguir da etapa de Importação da Tarefas (Vitor, 01/10/2026): o botão de avançar só aparece
// com tudo pronto —
//   cada banco Ok (extrato e razão batem no período; o banco sem movimento no período todo também vale);
//   importados na Conferência: Balancete, Entradas, Saídas, Tomados e, se a empresa presta serviço, Prestados.
// TypeScript puro: quem chama diz o estado de cada banco e o que a Conferência já tem.

export interface ImportadosDaConferencia { balancete: boolean; entradas: boolean; saidas: boolean; tomados: boolean; prestados: boolean }

export interface RequisitosDaImportacao {
  pronto: boolean;
  /** o que falta, em português curto (para o título do botão e o aviso) */
  faltam: string[];
}

/**
 * bancos: cada banco da linha, Ok ou sem movimento no período todo. importados: null = a Conferência ainda não
 * carregou (não está pronto). prestaServico: a regra do Cadastro (só true exige o Prestados).
 */
export function requisitosDaImportacao(
  bancos: readonly { nome: string; ok: boolean; semMovimento: boolean }[],
  importados: ImportadosDaConferencia | null,
  prestaServico: boolean | null,
): RequisitosDaImportacao {
  const faltam: string[] = [];
  for (const b of bancos) if (!b.ok && !b.semMovimento) faltam.push(b.nome + ': extrato e razão batendo');
  if (!importados) faltam.push('a Conferência carregar');
  else {
    if (!importados.balancete) faltam.push('Balancete');
    if (!importados.entradas) faltam.push('Entradas');
    if (!importados.saidas) faltam.push('Saídas');
    if (!importados.tomados) faltam.push('Tomados');
    if (prestaServico === true && !importados.prestados) faltam.push('Prestados');
  }
  return { pronto: faltam.length === 0, faltam };
}
