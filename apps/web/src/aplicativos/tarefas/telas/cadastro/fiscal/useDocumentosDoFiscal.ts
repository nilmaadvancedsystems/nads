// ViewModel de Cadastro › a empresa › Fiscal › Documentos e planilhas (Heverton, 20/10/2026: "Cadastro = Fiscal
// (inserir)": os documentos da empresa, a planilha da DEFIS, a da projeção do Fator R e a de rateio). O nads guarda só o
// link (o arquivo continua no Drive) e quando foi posto ou trocado; grava no cadastro da empresa, com o histórico. A pasta
// da empresa no Drive (o mapa do robô, que só o admin e o contábil leem) abre no Drive do nads ou no Google Drive.
import { empresas } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { useDriveDoEntregas } from '../../../dados/repo';
import { useCadastroAberto } from '../useCadastroAberto';

const cad = empresas.cadastro;
const quando = (iso: string) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '');

export function useDocumentosDoFiscal(rota: string) {
  const c = useCadastroAberto(rota);
  const drive = useDriveDoEntregas();
  const { toast, modal } = useRetorno();
  const docs = c.cadastro.documentosFiscais || {};
  // o link que se cola em cada planilha (o que está gravado aparece até a pessoa mudar)
  const [rascunho, setRascunho] = useState<Partial<Record<empresas.cadastro.PlanilhaDoFiscal, string>>>({});
  const [erro, setErro] = useState<Partial<Record<string, string>>>({});
  const [novo, setNovo] = useState({ nome: '', link: '' });
  const mapa = drive.mapa();
  const pasta = c.empresa.codigo != null ? mapa.clientes.find(p => p.codigo === String(c.empresa.codigo)) || null : null;
  function gravar(mudar: () => empresas.cadastro.CadastroDaEmpresa | { erro: string }, chave: string, ok: string): boolean {
    const r = mudar();
    if ('erro' in r) { setErro(e => ({ ...e, [chave]: r.erro })); return false; }
    setErro(e => ({ ...e, [chave]: '' }));
    if (r !== c.cadastro) { c.salvar(r); toast(ok); }
    return true;
  }
  return {
    carregando: c.carregando,
    empresa: c.empresa.nome,
    planilhas: cad.PLANILHAS_DO_FISCAL.map(p => {
      const a = docs.planilhas?.[p.id];
      return { id: p.id, rotulo: p.rotulo, link: rascunho[p.id] ?? a?.link ?? '', gravado: a?.link || '', atualizado: a ? quando(a.atualizadoEm) + (a.por ? ' por ' + a.por : '') : '', erro: erro[p.id] || '', mudou: rascunho[p.id] != null && rascunho[p.id] !== (a?.link || '') };
    }),
    mudarPlanilha: (id: empresas.cadastro.PlanilhaDoFiscal, link: string) => { setRascunho(r => ({ ...r, [id]: link })); setErro(e => ({ ...e, [id]: '' })); },
    gravarPlanilha(id: empresas.cadastro.PlanilhaDoFiscal) {
      if (c.carregando) return;
      const link = (rascunho[id] ?? '').trim();
      if (gravar(() => cad.definirPlanilhaDoFiscal(c.cadastro, id, link, c.por, new Date()), id, link ? 'Link guardado.' : 'Link tirado.')) setRascunho(r => { const n = { ...r }; delete n[id]; return n; });
    },
    async tirarPlanilha(id: empresas.cadastro.PlanilhaDoFiscal) {
      if (c.carregando) return;
      const ok = await modal({ icone: 'alert', titulo: 'Tirar o link?', texto: 'O arquivo continua no Drive; só o link sai do cadastro.',
        botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Tirar', valor: true, variante: 'btn-primary' }] });
      if (ok) gravar(() => cad.definirPlanilhaDoFiscal(c.cadastro, id, '', c.por, new Date()), id, 'Link tirado.');
    },
    /** os outros documentos da empresa */
    outros: (docs.outros || []).map((a, i) => ({ indice: i, nome: a.nome, link: a.link, atualizado: quando(a.atualizadoEm) + (a.por ? ' por ' + a.por : '') })),
    novo,
    mudarNovo: (m: Partial<typeof novo>) => { setNovo(n => ({ ...n, ...m })); setErro(e => ({ ...e, novo: '' })); },
    erroNovo: erro.novo || '',
    acrescentar() {
      if (c.carregando) return;
      if (gravar(() => cad.acrescentarDocumentoDoFiscal(c.cadastro, novo.nome, novo.link, c.por, new Date()), 'novo', 'Documento guardado.')) setNovo({ nome: '', link: '' });
    },
    async tirar(indice: number) {
      if (c.carregando) return;
      const a = docs.outros?.[indice];
      const ok = await modal({ icone: 'alert', titulo: 'Tirar ' + (a?.nome || 'o documento') + '?', texto: 'O arquivo continua no Drive; só o link sai do cadastro.',
        botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Tirar', valor: true, variante: 'btn-primary' }] });
      if (ok) gravar(() => cad.tirarDocumentoDoFiscal(c.cadastro, indice, c.por, new Date()), 'novo', 'Documento tirado.');
    },
    /** a pasta da empresa no Drive (o mapa do robô; sem permissão ou sem pasta, null) */
    pasta: pasta ? { nome: pasta.nomePasta || pasta.nome, noNads: '/tarefas/drive/pastas?c=' + encodeURIComponent(pasta.id), noGoogle: 'https://drive.google.com/drive/folders/' + encodeURIComponent(pasta.id), mod: pasta.mod ? quando(pasta.mod) : '' } : null,
    mapaCarregado: mapa.carregado,
    semMapa: mapa.carregado && !!mapa.erro,
  };
}
