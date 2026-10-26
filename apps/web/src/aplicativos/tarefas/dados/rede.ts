// O IP público deste navegador (Senhas › Acesso, 26/10/2026: "quero que apareça o IP"; liberado na trava das conexões):
// o navegador não sabe o próprio IP da internet, então pergunta ao api.ipify.org, público e sem chave. Nada do nads vai
// junto: é só a pergunta, e volta só o IP. Uma vez por aba; se não responder em 5 s, fica vazio. Nos exemplos, um IP de
// documentação (nada sai do navegador).
import { noBanco } from './fonte';

const ENDERECO = 'https://api.ipify.org?format=json';

let pedido: Promise<string> | null = null;

/** O IP público deste navegador, ou '' se a consulta falhar. */
export function meuIp(): Promise<string> {
  if (!noBanco) return Promise.resolve('203.0.113.10');
  if (!pedido) {
    pedido = (async () => {
      try {
        const r = await fetch(ENDERECO, { signal: AbortSignal.timeout(5000), cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
        if (!r.ok) return '';
        const ip = String(((await r.json()) as { ip?: unknown }).ip || '');
        return /^[0-9a-fA-F.:]{3,45}$/.test(ip) ? ip : '';
      } catch { return ''; }
    })();
    // falhou: a próxima abertura tenta de novo
    void pedido.then(ip => { if (!ip) pedido = null; });
  }
  return pedido;
}
