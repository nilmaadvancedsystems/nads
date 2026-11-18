// A consulta do CNPJ na Receita (Vitor, 13/10/2026: "coloca o cadastro por CNPJ via Receita"; liberado na trava das
// conexões): a BrasilAPI e, se ela falhar, a minhareceita.org — as duas públicas, sem chave, o mesmo formato e as
// mesmas do Entregas. Só o CNPJ sai daqui. Nos exemplos, a resposta é inventada (nada sai do navegador).
// 17/11/2026: a mesma consulta traz a situação inteira (o botão Consultar na Receita do Cadastro › Empresa), e as falhas
// ficam separadas: CNPJ inválido, não encontrado, limite de pedidos ou fora do ar.
import { empresas } from '@nads/core';
import { noBanco } from './fonte';

const FONTES = ['https://brasilapi.com.br/api/cnpj/v1/', 'https://minhareceita.org/'] as const;
/** quanto esperar cada fonte antes de tentar a outra */
const ESPERA_MS = 20000;

/** A consulta não trouxe a empresa: a falha e a mensagem para a pessoa. */
export class ErroDaReceita extends Error {
  constructor(readonly falha: empresas.cadastro.FalhaDaReceita) {
    super(empresas.cadastro.MENSAGEM_DA_FALHA[falha]);
    this.name = 'ErroDaReceita';
  }
}

/** Pede às fontes, uma depois da outra, até uma responder com a empresa (`ler` confere a resposta). */
async function buscar<T>(cnpj: string, ler: (resposta: unknown, digitos: string) => T | null): Promise<T> {
  const digitos = cnpj.replace(/\D/g, '');
  if (!empresas.cadastro.cnpjValido(digitos)) throw new ErroDaReceita('invalido');
  const falhas: empresas.cadastro.FalhaDaReceita[] = [];
  for (const fonte of FONTES) {
    try {
      const r = await fetch(fonte + digitos, { signal: AbortSignal.timeout(ESPERA_MS) });
      const falha = empresas.cadastro.falhaDaResposta(r.status);
      if (falha) { falhas.push(falha); continue; }
      const d = ler(await r.json(), digitos);
      if (d) return d;
      falhas.push('fora-do-ar');
    } catch { falhas.push('fora-do-ar'); /* sem conexão com esta fonte (ou demorou): tenta a outra */ }
  }
  throw new ErroDaReceita(empresas.cadastro.falhaQueVale(falhas));
}

/** O que a Receita diz do CNPJ (para o cadastro de empresa nova e as notas); erro com a mensagem para a pessoa. */
export async function consultarCnpj(cnpj: string): Promise<empresas.cadastro.DadosDaReceita> {
  if (!noBanco) {
    const digitos = cnpj.replace(/\D/g, '');
    if (!empresas.cadastro.cnpjValido(digitos)) throw new ErroDaReceita('invalido');
    return { cnpj: digitos, razaoSocial: 'EMPRESA EXEMPLO (TESTE) LTDA', fantasia: 'EXEMPLO', situacao: 'ATIVA', regime: 'Simples',
      cnae: '4711-3/02', cnaeDescricao: 'Comércio varejista de mercadorias em geral', municipio: 'MONTES CLAROS', uf: 'MG', abertura: '2020-01-02',
      endereco: { cMun: '3143302', cep: '39400001', logradouro: 'RUA EXEMPLO', numero: '100', bairro: 'CENTRO' } };
  }
  return buscar(cnpj, j => empresas.cadastro.dadosDaReceita(j));
}

/**
 * A situação inteira na Receita (o retrato: a situação com a data e o motivo, os nomes, o endereço, as atividades, a
 * natureza, o porte, o capital, os sócios e o Simples/MEI); ErroDaReceita com a falha e a mensagem.
 */
export async function consultarSituacaoNaReceita(cnpj: string, agora = new Date()): Promise<empresas.cadastro.RetratoDaReceita> {
  if (!noBanco) {
    const digitos = cnpj.replace(/\D/g, '');
    if (!empresas.cadastro.cnpjValido(digitos)) throw new ErroDaReceita('invalido');
    // nos exemplos, uma resposta inventada para o mesmo CNPJ (com mudanças, para a tela ter o que mostrar)
    const r = empresas.cadastro.retratoDaReceita({
      cnpj: digitos, razao_social: 'EMPRESA EXEMPLO (TESTE) LTDA', nome_fantasia: 'EXEMPLO', descricao_situacao_cadastral: 'ATIVA',
      data_situacao_cadastral: '2020-01-02', descricao_tipo_de_logradouro: 'RUA', logradouro: 'EXEMPLO', numero: '100', bairro: 'CENTRO',
      municipio: 'MONTES CLAROS', uf: 'MG', cep: '39400001', cnae_fiscal: 4711302, cnae_fiscal_descricao: 'Comércio varejista de mercadorias em geral',
      cnaes_secundarios: [{ codigo: 4721102, descricao: 'Padaria e confeitaria com predominância de revenda' }],
      natureza_juridica: 'Sociedade Empresária Limitada', porte: 'MICRO EMPRESA', capital_social: 50000, data_inicio_atividade: '2020-01-02',
      qsa: [{ nome_socio: 'PESSOA EXEMPLO', qualificacao_socio: 'Sócio-Administrador', data_entrada_sociedade: '2020-01-02' }],
      opcao_pelo_simples: true, data_opcao_pelo_simples: '2020-01-02', opcao_pelo_mei: false,
    }, digitos, agora);
    if (!r) throw new ErroDaReceita('fora-do-ar');
    return r;
  }
  return buscar(cnpj, (j, digitos) => empresas.cadastro.retratoDaReceita(j, digitos, agora));
}
