// As células da conta e do histórico, as mesmas na tabela dos Lançamentos e na do Razão do SCI (25/11/2026).
import type { sci } from '@nads/core';

/** a conta na tabela: o nome, maior, e o código entre parênteses ao lado (24/11/2026: "Coloca o nome da conta maior e a conta entre parentese () na frente") */
export function ContaNaTabela({ codigo, nome, lado }: { codigo: string; nome: string; lado: sci.LadoDoLancamento }) {
  // o débito em azul e o crédito em vermelho (24/11/2026: "Pinta o debito de azul e o credito de vermelho")
  const cor = 'sci-conta-nome ' + (lado === 'debito' ? 'sci-conta-d' : 'sci-conta-c');
  if (!codigo) return <span className="hint">—</span>;
  if (!nome) return <span className={cor}>{codigo}</span>;
  // numa linha só: o nome longo corta no "…" e vem inteiro no hover (25/11/2026: no Razão do SCI a tabela passava da caixa)
  return <span className="sci-conta-cel" title={nome + ' (' + codigo + ')'}><span className={cor}>{nome}</span> <span className="sci-conta-cod">({codigo})</span></span>;
}

/**
 * O histórico e o complemento numa coluna só, só para ver (24/11/2026: "Pode fazer um so, porem na exportacao deixe certo em
 * tabela, e so pro usuario ver melhor"): o texto do histórico, o complemento e o número entre parênteses; a planilha segue com os dois
 */
export function HistoricoNaTabela({ codigo, nome, complemento }: { codigo: string; nome: string; complemento: string }) {
  const texto = [nome, complemento].filter(Boolean).join(' ');
  if (!texto && !codigo) return <span className="hint">—</span>;
  // numa linha só, com o resto no "…" e o texto inteiro no hover: o simples e o múltiplo com a mesma altura (25/11/2026: "Deixa os
  // multiplos e lancamentos normais com a mesma altura de box")
  return (
    <span className="sci-hist-cel" title={[texto, codigo && '(' + codigo + ')'].filter(Boolean).join(' ')}>
      {texto && <span className="sci-conta-nome">{texto}</span>}{codigo && <>{texto ? ' ' : ''}<span className="sci-conta-cod">({codigo})</span></>}
    </span>
  );
}
