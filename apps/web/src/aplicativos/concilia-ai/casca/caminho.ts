// Onde o Concilia aí mora na URL: /<código da empresa>/<seção>/<página>
// (ex.: /292/movimento/relatorio, /292/conciliadorzinho/bandeiras). A raiz é a escolha de empresa.

/** Caminho no app (sem nada = a escolha de empresa). */
export function caminho(resto = ''): string {
  return '/' + resto;
}
