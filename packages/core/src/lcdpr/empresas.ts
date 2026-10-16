// As empresas que fazem o LCDPR (16/10/2026: "coloque o lcdpr como parte da empresa 62 de carlos lucas apenas"; na rotina,
// o mesmo dia: "ele só precisa do lcdpr"). Mora no core porque decide a rotina do Contábil delas (tarefas/rotinas/rotinaDo:
// rotinaDaEmpresa) e o aplicativo lê daqui.
export const EMPRESAS_COM_LCDPR: readonly number[] = [62];

/** A empresa faz o LCDPR? (código do ERP) */
export const temLcdpr = (codigo: number | null | undefined): boolean => codigo != null && EMPRESAS_COM_LCDPR.includes(codigo);
