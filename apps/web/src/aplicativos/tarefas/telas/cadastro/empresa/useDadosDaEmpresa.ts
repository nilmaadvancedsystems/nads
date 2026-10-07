// ViewModel de Cadastro › Empresa: as regras da empresa que os aplicativos seguem. Hoje, "presta serviços?"
// (Vitor, 30/09/2026: a regra fica no Cadastro): decide a aba Prestados na Importação e os serviços prestados
// na Conferência. Grava na hora, com o registro no histórico.
import { empresas } from '@nads/core';
import { useCadastroAberto } from '../useCadastroAberto';

export function useDadosDaEmpresa(rota: string) {
  const c = useCadastroAberto(rota);
  return {
    empresa: c.empresa,
    carregando: c.carregando,
    /** true, false ou null (não informado) */
    prestaServico: c.cadastro.prestaServico ?? null,
    definirPrestaServico(sim: boolean) {
      if (c.carregando) return;
      const atual = c.cadastro.prestaServico ?? null;
      // clicar no que já está marcado volta para "não informado"
      const novo = empresas.cadastro.definirPrestaServico(c.cadastro, atual === sim ? null : sim, c.por, new Date());
      if (novo !== c.cadastro) c.salvar(novo);
    },
    /** os cartões (Vitor, 07/10/2026): true, false ou null (não informado); ligam a etapa Cartões na Tarefas */
    cartaoEmpresarial: c.cadastro.cartaoEmpresarial ?? null,
    vendeNoCartao: c.cadastro.vendeNoCartao ?? null,
    definirCartao(campo: 'cartaoEmpresarial' | 'vendeNoCartao', sim: boolean) {
      if (c.carregando) return;
      const atual = c.cadastro[campo] ?? null;
      // clicar no que já está marcado volta para "não informado"
      const novo = empresas.cadastro.definirCartao(c.cadastro, campo, atual === sim ? null : sim, c.por, new Date());
      if (novo !== c.cadastro) c.salvar(novo);
    },
    /** os sócios, com o nome e o CPF (a etapa Bancos acha a transferência para o sócio no extrato) */
    socios: c.cadastro.socios || [],
    /** grava a lista inteira (a linha vazia some) */
    definirSocios(lista: { nome: string; cpf: string }[]) {
      if (c.carregando) return;
      const novo = empresas.cadastro.definirSocios(c.cadastro, lista, c.por, new Date());
      if (novo !== c.cadastro) c.salvar(novo);
    },
  };
}
