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
  /**
   * Onde resolver cada um (na mesma ordem; null = não tem lugar): 'banco:<id>' (a linha do banco) ou 'aba:<id>' (a aba
   * da Importação: balancete, entradas, saidas, tomados, prestados). O "Resolver" da Tarefas leva até lá (Vitor, 02/10/2026).
   */
  alvos: (string | null)[];
}

/**
 * bancos: cada banco da linha, Ok ou sem movimento no período todo. importados: null = a Conferência ainda não
 * carregou (não está pronto). prestaServico: a regra do Cadastro (só true exige o Prestados).
 */
export function requisitosDaImportacao(
  bancos: readonly { id?: string; nome: string; ok: boolean; semMovimento: boolean; faltaCheque?: boolean }[],
  importados: ImportadosDaConferencia | null,
  prestaServico: boolean | null,
): RequisitosDaImportacao {
  const faltam: string[] = [];
  const alvos: (string | null)[] = [];
  const falta = (t: string, alvo: string | null) => { faltam.push(t); alvos.push(alvo); };
  // batendo, mas com dia negativo sem o cheque especial: na Importação passa (o cheque é a etapa seguinte)
  for (const b of bancos) if (!b.ok && !b.faltaCheque && !b.semMovimento) falta(b.nome + ': extrato e razão batendo', b.id ? 'banco:' + b.id : null);
  if (!importados) falta('a Conferência carregar', null);
  else {
    if (!importados.balancete) falta('Balancete', 'aba:balancete');
    if (!importados.entradas) falta('Entradas', 'aba:entradas');
    if (!importados.saidas) falta('Saídas', 'aba:saidas');
    if (!importados.tomados) falta('Tomados', 'aba:tomados');
    if (prestaServico === true && !importados.prestados) falta('Prestados', 'aba:prestados');
  }
  return { pronto: faltam.length === 0, faltam, alvos };
}

/**
 * Os requisitos da etapa Cheque especial (Vitor, 01/10/2026): todo banco Ok — nos dias que fecham negativos, o razão
 * importado de novo já tem o cheque especial (o ajuste e o estorno) e, tirando ele, o extrato e o razão batem.
 */
export function requisitosDoChequeEspecial(
  bancos: readonly { id?: string; nome: string; ok: boolean; semMovimento: boolean; diasSemCheque: number }[],
): RequisitosDaImportacao {
  const faltam: string[] = [];
  const alvos: (string | null)[] = [];
  for (const b of bancos) {
    if (b.ok || b.semMovimento) continue;
    alvos.push(b.id ? 'banco:' + b.id : null);
    faltam.push(b.diasSemCheque > 0
      ? b.nome + ': o cheque especial de ' + b.diasSemCheque + (b.diasSemCheque === 1 ? ' dia negativo' : ' dias negativos') + ' e o razão importado de novo'
      : b.nome + ': extrato e razão batendo');
  }
  return { pronto: faltam.length === 0, faltam, alvos };
}
