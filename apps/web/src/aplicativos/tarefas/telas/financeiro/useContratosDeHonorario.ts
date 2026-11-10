// ViewModel da janela Clientes dos honorários (19/10/2026): os contratos (com o interruptor de ativo, o valor e as
// observações) e o Adicionar cliente, que escolhe da lista do escritório (a mesma da Nova nota: código ou nome).
import { empresas, financeiro, formatos } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useState } from 'react';
import { useOperador } from '../../casca/operador';
import { dadosDaEmpresaNoEntregas, empresasNovas, repoDoCadastro } from '../../dados/fonte';
import { useHonorarios } from '../../dados/repo';
import { valorDigitado } from './formatosDaNota';

type Contrato = financeiro.ContratoDeHonorario;

export function useContratosDeHonorario() {
  const repo = useHonorarios();
  const { toast } = useRetorno();
  const operador = useOperador().operador?.nome || '';
  const contratos = repo.contratos().lista;
  const [busca, setBusca] = useState('');
  const [somenteAtivos, setSomenteAtivos] = useState(false);
  // o CNPJ de cada cliente do Entregas, por código (lido uma vez); o do cadastro do nads vale primeiro
  const [docs, setDocs] = useState<ReadonlyMap<number, string>>(new Map());
  useEffect(() => {
    let vale = true;
    void dadosDaEmpresaNoEntregas().then(m => { if (vale) setDocs(new Map([...m].map(([c, d]) => [c, d.documento]))); });
    return () => { vale = false; };
  }, []);

  const lista: readonly empresas.EmpresaDoEscritorio[] = [...empresas.EMPRESAS_COM_DP, ...empresasNovas()];
  const jaTem = new Set(contratos.map(c => c.codigo));
  const q = formatos.nomeNorm(busca);
  const digitado = busca.trim();
  const peso = (e: empresas.EmpresaDoEscritorio) => (e.codigo != null && String(e.codigo) === digitado ? 0 : e.codigo != null && digitado && String(e.codigo).startsWith(digitado) ? 1 : 2);
  const achados = q
    ? lista.filter(e => e.codigo != null && !jaTem.has(String(e.codigo)) && formatos.nomeNorm(e.nome + ' ' + e.codigo).includes(q))
      .map((e, i) => ({ e, i })).sort((a, b) => peso(a.e) - peso(b.e) || a.i - b.i).slice(0, 8).map(x => x.e)
    : [];

  async function tentar(fazer: () => Promise<unknown>, msg: string) {
    try { await fazer(); } catch (e) { toast(msg + ' ' + (e instanceof Error ? e.message : '')); }
  }
  const rascunho = (c: Contrato) => ({ id: c.id, clienteId: c.clienteId, codigo: c.codigo, nome: c.nome, cnpj: c.cnpj, valor: c.valor, ativo: c.ativo, observacoes: c.observacoes });

  return {
    contratos: contratos.filter(c => !somenteAtivos || c.ativo).sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true })),
    total: contratos.length, somenteAtivos, setSomenteAtivos,
    busca, setBusca, achados,
    async adicionar(e: empresas.EmpresaDoEscritorio) {
      const cnpj = repoDoCadastro().todos().porId.get(formatos.slug(e.nome))?.cnpj || (e.codigo != null ? docs.get(e.codigo) : '') || '';
      await tentar(() => repo.salvarContrato({ clienteId: '', codigo: String(e.codigo), nome: e.nome, cnpj, valor: 0, ativo: true }, operador), 'Não consegui adicionar.');
      setBusca('');
    },
    alternarAtivo: (c: Contrato) => tentar(() => repo.salvarContrato({ ...rascunho(c), ativo: !c.ativo }, operador), 'Não consegui gravar.'),
    definirValor: (id: string, texto: string) => tentar(() => repo.definirValor(id, valorDigitado(texto), operador), 'Não consegui gravar o valor.'),
    salvarObservacoes: (c: Contrato, texto: string) => (texto.trim() === (c.observacoes ?? '') ? Promise.resolve() : tentar(() => repo.salvarContrato({ ...rascunho(c), observacoes: texto }, operador), 'Não consegui gravar.')),
  };
}
