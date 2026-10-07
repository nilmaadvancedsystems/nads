// Imprimir o código de recuperação do cofre (Vitor, 07/10/2026: "quando aparece a senha quero uma opção para imprimir"):
// uma folha só com o código, a data e onde usar — para guardar fora do sistema. Abre a janela de impressão do navegador
// numa aba à parte (o código não vai para nenhum servidor).
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

export function imprimirCodigoDoCofre(codigo: string, titulo: string): boolean {
  const w = window.open('', '_blank', 'width=720,height=520');
  if (!w) return false;
  const quando = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Código de recuperação do cofre</title>
<style>
  body{font-family:system-ui,Segoe UI,Arial,sans-serif;margin:48px;color:#111}
  h1{font-size:20px;margin:0 0 4px}
  p{margin:6px 0;color:#444;font-size:13px}
  .codigo{margin:28px 0;padding:18px 20px;border:2px solid #111;border-radius:8px;font:600 26px/1.4 Consolas,'Courier New',monospace;letter-spacing:.06em;text-align:center}
</style></head><body>
<h1>nads — cofre de senhas gov.br e certificados</h1>
<p>${esc(titulo)} · ${esc(quando)}</p>
<div class="codigo">${esc(codigo)}</div>
<p>Use em Senhas › "Abrir com o código" se ninguém mais tiver acesso ao cofre.</p>
<p>Guarde esta folha num lugar seguro, fora do computador.</p>
</body></html>`);
  w.document.close();
  w.focus();
  w.print();
  return true;
}
