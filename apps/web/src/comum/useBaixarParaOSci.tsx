// O "Baixar para o SCI" do botão Lançamentos das telas (23/11/2026, docs/sci: "Botão direto nas telas"; só no modo
// desenvolvedor, pela novidade 'sci'). Pega a mesma planilha do Baixar (a do Alterdata), pede o CNPJ (o do Cadastro, ou
// o último usado para a empresa neste navegador) e o histórico das linhas sem código, e baixa a planilha que o gerador
// do SCI importa. Nada é gravado no banco: só o CNPJ e o histórico ficam lembrados neste navegador, por conveniência.
import { sci } from '@nads/core';
import { baixarBytes, useRetorno } from '@nads/ui';
import { useState } from 'react';
import { cnpjNoCadastro } from '../aplicativos/tarefas/dados/cadastro.firestore';
import { useNovidade } from './novidades';

const CHAVE_DO_CNPJ = (empresa: string) => 'sciCnpj|' + empresa;
const CHAVE_DO_HISTORICO = 'sciHistorico';
function lembrado(k: string): string { try { return localStorage.getItem(k) || ''; } catch { return ''; } }
function lembrar(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* sem armazenamento */ } }

export interface PlanilhaDaTela { bytes: Uint8Array; linhas: number }

export function useBaixarParaOSci(empresa: string, origem: string, planilha: () => PlanilhaDaTela | null) {
  const ligado = useNovidade('sci');
  const { modal, aviso } = useRetorno();
  const [ocupado, setOcupado] = useState(false);

  async function baixar() {
    const pl = planilha();
    if (!pl || !pl.linhas) return aviso({ tom: 'info', titulo: 'Nada para o SCI', texto: 'Esta tela ainda não tem lançamentos para baixar.' });
    setOcupado(true);
    try {
      let cnpj = lembrado(CHAVE_DO_CNPJ(empresa));
      if (!cnpj) cnpj = await cnpjNoCadastro(empresa).catch(() => '');
      const valores = { cnpj: sci.documentoComMascara(cnpj), historico: lembrado(CHAVE_DO_HISTORICO) };
      const ok = await modal<boolean>({
        icone: 'download', titulo: 'Baixar para o SCI',
        texto: pl.linhas + (pl.linhas === 1 ? ' lançamento' : ' lançamentos') + ' de ' + empresa + ', na planilha que o SCI importa (Lançamentos contábeis via planilha).',
        corpo: (
          <div className="sci-janela">
            <label className="hint" htmlFor="sci-janela-cnpj">CNPJ da empresa no SCI</label>
            <input id="sci-janela-cnpj" type="text" inputMode="numeric" defaultValue={valores.cnpj} placeholder="00.000.000/0000-00" onChange={e => { valores.cnpj = e.target.value; }} />
            <label className="hint" htmlFor="sci-janela-historico">Histórico para as linhas sem código</label>
            <input id="sci-janela-historico" type="text" inputMode="numeric" defaultValue={valores.historico} placeholder="ex.: 116" onChange={e => { valores.historico = e.target.value.replace(/\D/g, ''); }} />
          </div>
        ),
        botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Baixar', valor: true, variante: 'btn-primary' }],
      });
      if (!ok) return;
      const r = sci.planilhaDoSciDaTela(pl.bytes, origem, { cnpjEmpresa: valores.cnpj, historicoPadrao: valores.historico });
      if (!r.resumo.total) return aviso({ tom: 'erro', titulo: 'Nenhum lançamento pronto para o SCI', texto: 'Não achei lançamentos na planilha desta tela.' });
      if (!r.resumo.prontos) {
        const motivo = sci.lancamentosParaOSci(sci.lerPlanilhaDoNads(pl.bytes, origem), { cnpjEmpresa: valores.cnpj, historicoPadrao: valores.historico })
          .flatMap(l => l.problemas);
        return aviso({ tom: 'erro', titulo: 'Nenhum lançamento pronto para o SCI', texto: [...new Set(motivo)].slice(0, 3).join('; ') + '.' });
      }
      lembrar(CHAVE_DO_CNPJ(empresa), valores.cnpj.replace(/\D/g, ''));
      if (valores.historico) lembrar(CHAVE_DO_HISTORICO, valores.historico);
      baixarBytes(r.bytes, r.nome, sci.TIPO_XLSX_SCI);
      if (r.resumo.comProblema) {
        aviso({ tom: 'info', titulo: r.resumo.comProblema + (r.resumo.comProblema === 1 ? ' lançamento ficou' : ' lançamentos ficaram') + ' na aba Conferir', texto: 'A aba Importar leva só os prontos; a Conferir mostra o motivo de cada um.' });
      }
    } catch (e) {
      aviso({ tom: 'erro', titulo: 'Não consegui montar a planilha do SCI', texto: e instanceof Error ? e.message : undefined });
    } finally { setOcupado(false); }
  }

  return { ligado, ocupado, baixar: () => void baixar() };
}
