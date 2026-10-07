// ViewModel de Senhas › Contas gov.br (Vitor, 07/10/2026: "importe essas senhas gov"): as contas gov.br de pessoas no
// cofre (o nome e o nível às claras; o CPF, a senha e a observação embaralhados), a busca, a importação da planilha (lê no
// navegador, mostra a prévia — novas e as que atualizam — e só grava embaralhado) e a conta aberta na janela.
import { cofre as c } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useState } from 'react';
import { useCofre } from './useCofre';

type Previa = { arquivo: string; contas: (c.ContaGovDaPlanilha & { id: string; existe: boolean })[]; ignoradas: number };

export function useContasGov() {
  const cofre = useCofre();
  const { toast } = useRetorno();
  const [busca, setBusca] = useState('');
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [importando, setImportando] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);
  const [conta, setConta] = useState<c.SenhaGov | null>(null);
  const q = busca.trim().toLowerCase();
  const contas = cofre.contasGov.filter(x => !q || x.nome.toLowerCase().includes(q)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const daAberta = aberta ? cofre.contasGov.find(x => x.id === aberta) || null : null;

  useEffect(() => {
    if (!aberta || cofre.estado !== 'aberto') { setConta(null); return; }
    let vale = true;
    void cofre.lerPorId(aberta).then(s => { if (vale) setConta(s?.gov || { login: '', senha: '' }); });
    return () => { vale = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta, cofre.estado]);

  return {
    cofre,
    contas,
    total: cofre.contasGov.length,
    busca, setBusca,
    previa,
    importando,
    /** lê a planilha escolhida (nada sai do navegador) e monta a prévia */
    async escolherPlanilha(f: File | null) {
      if (!f) { setPrevia(null); return; }
      const r = c.lerPlanilhaDeSenhas(await f.arrayBuffer());
      if (r.erro) { toast(r.erro); return; }
      const ids = new Set(cofre.contasGov.map(x => x.id));
      const lista = await Promise.all(r.contas.map(async k => { const id = await c.idDaContaGov(k.cpf); return { ...k, id, existe: ids.has(id) }; }));
      setPrevia({ arquivo: f.name, contas: lista, ignoradas: r.ignoradas });
    },
    cancelarPrevia: () => setPrevia(null),
    async importar() {
      if (!previa || importando) return;
      setImportando(true);
      try {
        const n = await cofre.importarContasGov(previa.contas);
        if (n) { toast(n + (n === 1 ? ' conta guardada' : ' contas guardadas') + ' no cofre.'); setPrevia(null); }
      } catch (e) { toast('Não deu: ' + (e instanceof Error ? e.message : String(e))); } finally { setImportando(false); }
    },
    aberta: daAberta,
    conta, setConta,
    abrir: (id: string) => setAberta(id),
    fechar: () => setAberta(null),
    async salvarConta() { if (aberta && conta) await cofre.salvarConta(aberta, conta); },
  };
}
