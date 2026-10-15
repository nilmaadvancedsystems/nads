// A consulta do CNPJ na Receita (Vitor, 13/10/2026: "coloca o cadastro por CNPJ via Receita"; liberado na trava das
// conexões): a BrasilAPI e, se ela falhar, a minhareceita.org — as duas públicas, sem chave, o mesmo formato e as
// mesmas do Entregas. Só o CNPJ sai daqui. Nos exemplos, a resposta é inventada (nada sai do navegador).
import { empresas } from '@nads/core';
import { noBanco } from './fonte';

const FONTES = ['https://brasilapi.com.br/api/cnpj/v1/', 'https://minhareceita.org/'] as const;

/** O que a Receita diz do CNPJ; erro com a mensagem para a pessoa (CNPJ inválido, não encontrado, sem resposta). */
export async function consultarCnpj(cnpj: string): Promise<empresas.cadastro.DadosDaReceita> {
  const digitos = cnpj.replace(/\D/g, '');
  if (!empresas.cadastro.cnpjValido(digitos)) throw new Error('CNPJ inválido: confira os 14 números.');
  if (!noBanco) {
    return { cnpj: digitos, razaoSocial: 'EMPRESA EXEMPLO (TESTE) LTDA', fantasia: 'EXEMPLO', situacao: 'ATIVA', regime: 'Simples',
      cnae: '4711-3/02', cnaeDescricao: 'Comércio varejista de mercadorias em geral', municipio: 'MONTES CLAROS', uf: 'MG', abertura: '2020-01-02',
      endereco: { cMun: '3143302', cep: '39400001', logradouro: 'RUA EXEMPLO', numero: '100', bairro: 'CENTRO' } };
  }
  let naoAchou = false;
  for (const fonte of FONTES) {
    try {
      const r = await fetch(fonte + digitos);
      if (r.status === 404) { naoAchou = true; continue; }
      if (!r.ok) continue;
      const d = empresas.cadastro.dadosDaReceita(await r.json());
      if (d) return d;
    } catch { /* sem conexão com esta fonte: tenta a outra */ }
  }
  throw new Error(naoAchou ? 'CNPJ não encontrado na Receita.' : 'A consulta da Receita não respondeu agora. Tente de novo.');
}
