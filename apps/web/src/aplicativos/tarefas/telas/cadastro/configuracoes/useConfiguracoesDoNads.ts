// ViewModel de Cadastro › Configurações: a proteção do login (config/nads), o robô que lê agência e conta
// (config/indiceDrive.contas) e a saúde do robô do Entregas (só admin e contábil veem; lida a cada 30 s).
// Só o admin muda; ligar a proteção pede confirmação.
import { entregas } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useOperador } from '../../../casca/operador';
import { useAcesso, useLeituraDoRobo, useSaudeDoRobo } from '../../../dados/repo';

export function useConfiguracoesDoNads() {
  const repo = useAcesso();
  const robo = useLeituraDoRobo();
  const { toast, modal } = useRetorno();
  const operador = useOperador().operador;
  const admin = !!operador?.admin;
  const docsDaSaude = useSaudeDoRobo();
  const config = repo.config();
  return {
    admin,
    carregando: !config.carregada || !robo.carregado,
    protecao: config.protecao,
    robo: robo.ligado,
    liberados: repo.sessoes().length,
    pendentes: repo.pendentes().length,
    /** o cartão da saúde do robô: só para quem lê o robô (admin e contábil) */
    veSaude: admin || operador?.departamento === 'contabil',
    saude: docsDaSaude ? entregas.saudeDoRobo(docsDaSaude) : null,
    async alternarProtecao() {
      if (!admin) { toast('Só um administrador muda a proteção do login.'); return; }
      const ligar = !config.protecao;
      if (ligar) {
        const ok = await modal<boolean>({ icone: 'lock', titulo: 'Ligar a proteção do login?',
          texto: 'Quem não é administrador e ainda não foi liberado vai precisar do código de um administrador na próxima vez que abrir o nads (inclusive quem já está com ele aberto).',
          botoes: [{ rotulo: 'Voltar', valor: false, variante: 'btn-outline' }, { rotulo: 'Ligar', valor: true, variante: 'btn-primary' }] });
        if (!ok) return;
      }
      try { await repo.gravarProtecao(ligar); toast(ligar ? 'Proteção do login ligada.' : 'Proteção do login desligada.'); }
      catch (err) { toast('Não consegui mudar: ' + (err as Error).message); }
    },
    async alternarRobo() {
      if (!admin) { toast('Só um administrador liga ou desliga o robô.'); return; }
      try { await robo.mudar(!robo.ligado); toast(!robo.ligado ? 'Robô ligado.' : 'Robô desligado.'); }
      catch (err) { toast('Não consegui mudar: ' + (err as Error).message); }
    },
  };
}
