// O Concilia aí só para conferir as entradas (Vitor, 01/10/2026: "um link separado do Concilia aí, completo, conectado
// ao banco, com apenas a função de conferir entradas"). Ligado na construção do site (VITE_SO_ENTRADAS=1, a prévia
// "conferir-entradas" do scripts/sites.mjs): a Importação só com Balancete e Entradas; o Movimento só com o Relatório
// e as Naturezas, os dois fixos em Entradas. Os dados são os mesmos da Conferência (o mesmo banco).
export const SO_ENTRADAS = import.meta.env.VITE_SO_ENTRADAS === '1';
