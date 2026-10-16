// Entrega um arquivo ao navegador (o clique do "Baixar guia"). Fica fora dos hooks porque mexe no DOM.
export function baixarArquivo(nome: string, arquivo: Blob): void {
  const url = URL.createObjectURL(arquivo);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
