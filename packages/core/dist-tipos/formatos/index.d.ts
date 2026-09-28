export declare const MES: string[];
/** 1234.5 → "1.234,50" */
export declare function brl(n: number): string;
/** Lê número de planilha em formato brasileiro: "1.234,56", "(1.234,56)", "1.234,56 D". */
export declare function num(v: unknown): number | null;
/** "05/03/2026" → "2026-03" (competência). */
export declare function comp(dt: string | null | undefined): string;
/** "05/03/2026" → 20260305 (para ordenar e comparar). 0 quando não é data. */
export declare function dataOrdem(dt: string | null | undefined): number;
/** "2026-03" → "março de 2026" */
export declare function rot(c: string): string;
/** "2026-03" → "mar/26" */
export declare function mesCurto(c: string): string;
/** Para comparar nomes: sem acento, minúsculo, só letras/números separados por espaço. */
export declare function nomeNorm(s: unknown): string;
export declare function normalizarTexto(s: unknown): string;
export declare function slug(nome: string): string;
export declare function capital(s: string): string;
/** Lançamento sem zeros à esquerda e sem ".0" do Excel: "00182" → "182". */
export declare function lancN(l: unknown): string;
/** Mostra o código cadastrado ("182") com os zeros do lançamento da nota ("00182"). */
export declare function lancComZeros(l: unknown, modelo: unknown): string;
/** CPF/CNPJ só com letras e números; "000" vira vazio. */
export declare function docLimpo(doc: unknown): string;
export declare function ehCpf(doc: unknown): boolean;
/** "Exportado" vem "Sim"/"Não" (notas) ou "S"/"N" (serviços): padroniza pros dois. */
export declare function normExportado(v: unknown): '' | 'Sim' | 'Não';
/** Compara códigos numéricos como a Conferência ("2" antes de "10"). */
export declare function compararNumerico(a: string, b: string): number;
/** CSV do escritório: separador ";", BOM para o Excel abrir com acento. */
export declare function montarCsv(linhas: string[]): string;
/** Máscara dd/mm/aaaa enquanto digita. */
export declare function mascaraData(v: string): string;
/** "28/09/2026 às 10:22" */
export declare function dataHora(ts: string): string;
