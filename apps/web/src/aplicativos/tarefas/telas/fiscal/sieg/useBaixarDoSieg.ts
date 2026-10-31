// ViewModel do Fiscal › SIEG (31/10/2026: "coloca uma função de baixar do sieg q tinha na rotina … coloca um módulo la"):
// a empresa e o mês na barra, e o mesmo painel do SIEG da rotina (as notas do mês, Contar agora e Baixar XMLs pelo robô),
// sem precisar abrir a rotina da empresa. A empresa aberta em Minhas empresas chega já escolhida (?empresa=código).
import { empresas as emp, tarefas as t } from '@nads/core';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { competenciasDaTela } from '../../../casca/navegacao';
import { useRepo } from '../../../dados/repo';
import { useEmpresasPermitidas } from '../../empresas/andamento';

export function useBaixarDoSieg() {
  const repo = useRepo();
  const [params] = useSearchParams();
  const [codigo, setCodigo] = useState<number | null>(() => Number(params.get('empresa')) || null);
  const [busca, setBusca] = useState('');
  const [ativo, setAtivo] = useState(0);
  const [competencia, setCompetencia] = useState(() => competenciasDaTela(1)[0]);

  const empresas = useEmpresasPermitidas().filtrar(repo.listarEmpresas()).filter(e => e.codigo != null);
  const empresa = codigo != null ? empresas.find(e => e.codigo === codigo) || null : null;
  const q = busca.trim();
  const achadas = q ? emp.buscarEmpresas(empresas, q).slice(0, 8) : [];
  const escolher = (e: { codigo: number | string | null }) => { setCodigo(Number(e.codigo)); setBusca(''); };

  return {
    empresa: empresa ? { codigo: empresa.codigo as number, nome: empresa.nome } : null,
    busca, setBusca: (v: string) => { setBusca(v); setAtivo(0); }, achadas, ativo, setAtivo,
    mover(d: number) { setAtivo(i => Math.max(0, Math.min(achadas.length - 1, i + d))); },
    escolher,
    escolherDestacado() { const e = achadas[ativo]; if (e) escolher(e); },
    trocarEmpresa() { setCodigo(null); },
    competencia, setCompetencia,
    rotuloCompetencia: t.rotuloCompetencia(competencia),
  };
}
