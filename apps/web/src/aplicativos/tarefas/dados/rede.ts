// De onde este navegador entra (Senhas › Acesso, 26/10/2026: "quero que apareça o IP" e "a localização de cidade";
// liberado na trava das conexões): o navegador não sabe o próprio IP da internet, então pergunta ao ipwho.is, público e
// sem chave, que devolve o IP e a cidade aproximada (a do IP: às vezes a da operadora). Nada do nads vai junto: é só a
// pergunta. Uma vez por aba; se não responder em 5 s, fica vazio. Nos exemplos, um IP de documentação (nada sai do
// navegador).
import { cofre } from '@nads/core';
import { noBanco } from './fonte';

const ENDERECO = 'https://ipwho.is/?fields=ip,success,city,region_code,country_code';

export interface OndeEstou { ip: string; cidade: string }

let pedido: Promise<OndeEstou> | null = null;

/** O IP público deste navegador e a cidade dele ("Montes Claros/MG"), ou vazios se a consulta falhar. */
export function ondeEstou(): Promise<OndeEstou> {
  if (!noBanco) return Promise.resolve({ ip: '203.0.113.10', cidade: 'Taiobeiras/MG' });
  if (!pedido) {
    pedido = (async () => {
      try {
        const r = await fetch(ENDERECO, { signal: AbortSignal.timeout(5000), cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
        if (!r.ok) return { ip: '', cidade: '' };
        const d = (await r.json()) as { success?: unknown; ip?: unknown; city?: unknown; region_code?: unknown; country_code?: unknown };
        if (d.success === false) return { ip: '', cidade: '' };
        const ip = String(d.ip || '');
        return { ip: /^[0-9a-fA-F.:]{3,45}$/.test(ip) ? ip : '', cidade: cofre.cidadeDoIp({ cidade: d.city, uf: d.region_code, pais: d.country_code }) };
      } catch { return { ip: '', cidade: '' }; }
    })();
    // falhou: a próxima abertura tenta de novo
    void pedido.then(o => { if (!o.ip) pedido = null; });
  }
  return pedido;
}
