// ViewModel de Financeiro › Configurações (15/10/2026: "vamos criar um emissor de notas fiscais para o financeiro"): a
// configuração do emissor (config/nfse): o ambiente, a série e a numeração, o prestador (a Nilma), o serviço e o token da
// prefeitura. Grava ao sair de cada campo, como o Cadastro › Empresa; campo inválido não grava e devolve o aviso. Sem
// configuração no banco, começa da CONFIG_PADRAO (os dados da nota real do escritório). O token só entra: não se lê de volta.
import { nfse } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { useOperador } from '../../casca/operador';
import { useNfse } from '../../dados/repo';
import { documentoFormatado } from './formatosDaNota';

export const OPCOES_DO_SIMPLES: { id: 1 | 2 | 3; rotulo: string }[] = [
  { id: 1, rotulo: 'Não optante' },
  { id: 2, rotulo: 'MEI' },
  { id: 3, rotulo: 'ME/EPP' },
];
export const OPCOES_DA_APURACAO: { id: 1 | 2 | 3; rotulo: string }[] = [
  { id: 1, rotulo: 'Tudo pelo Simples' },
  { id: 2, rotulo: 'ISS fora do Simples' },
  { id: 3, rotulo: 'Tudo fora do Simples' },
];
export const AMBIENTES: { id: nfse.AmbienteNfse; rotulo: string }[] = [
  { id: 'homologacao', rotulo: 'Homologação' },
  { id: 'producao', rotulo: 'Produção' },
];

export function useConfiguracoesDoFinanceiro() {
  const repo = useNfse();
  const { toast, modal } = useRetorno();
  const por = useOperador().operador?.nome || '';
  const cfg = repo.config();
  const config = cfg.config ?? nfse.CONFIG_PADRAO;
  // o aviso de cada campo inválido, até a próxima tentativa
  const [avisos, setAvisos] = useState<Record<string, string>>({});
  const [token, setToken] = useState('');
  const [gravandoToken, setGravandoToken] = useState(false);

  /** `feito` é a configuração nova, ou o aviso (texto) de que o valor não serve; igual à de agora, não grava */
  function gravar(campo: string, feito: nfse.ConfigNfse | string) {
    if (typeof feito === 'string') { setAvisos(a => ({ ...a, [campo]: feito })); return; }
    setAvisos(a => (a[campo] ? { ...a, [campo]: '' } : a));
    if (JSON.stringify(feito) === JSON.stringify(config)) return;
    void repo.salvarConfig(feito).catch(err => toast('Não consegui gravar: ' + (err instanceof Error ? err.message : String(err))));
  }
  const prestador = (campo: string, p: Partial<nfse.ConfigNfse['prestador']>) => gravar(campo, { ...config, prestador: { ...config.prestador, ...p } });
  const servico = (campo: string, s: Partial<nfse.ConfigNfse['servico']>) => gravar(campo, { ...config, servico: { ...config.servico, ...s } });

  return {
    carregando: !cfg.carregada,
    exemplos: repo.exemplos,
    semConfig: cfg.carregada && !cfg.config,
    config, avisos,
    /** sem configuração no banco: grava a padrão como está (os campos só gravam quando mudam) */
    gravarPadrao: () => { void repo.salvarConfig(config).catch(err => toast('Não consegui gravar: ' + (err instanceof Error ? err.message : String(err)))); },
    faltas: cfg.carregada ? nfse.faltasNaConfig(cfg.config, !!cfg.tokenGravadoEm) : [],
    robo: repo.robo(),
    cnpjFormatado: documentoFormatado(config.prestador.cnpj),
    aliquotaNoCampo: config.servico.pAliq == null ? '' : String(config.servico.pAliq).replace('.', ','),

    /** a nota passa a valer na Produção: pede confirmação */
    async definirAmbiente(a: nfse.AmbienteNfse) {
      if (a === config.ambiente) return;
      if (a === 'producao') {
        const sim = await modal<boolean>({
          icone: 'alert', titulo: 'Passar para Produção?',
          texto: 'Daqui para frente as notas emitidas valem de verdade: vão para a prefeitura com valor fiscal e o cliente recebe a cobrança do ISS. Confirme só com o token e o certificado de produção gravados.',
          botoes: [{ rotulo: 'Passar para Produção', valor: true, variante: 'btn-primary' }, { rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }],
        });
        if (!sim) return;
      }
      gravar('ambiente', { ...config, ambiente: a });
    },
    definirSerie(v: string) {
      const s = v.trim();
      gravar('serie', /^\d{1,5}$/.test(s) ? { ...config, serie: String(Number(s)) } : 'A série são só números (até 5 dígitos).');
    },
    definirProximoNumero(ambiente: nfse.AmbienteNfse, v: string) {
      const n = Number(v.trim());
      gravar('numero-' + ambiente, Number.isInteger(n) && n >= 1 ? { ...config, proximoNumero: { ...config.proximoNumero, [ambiente]: n } } : 'O próximo número precisa ser um inteiro a partir de 1.');
    },
    definirCnpj(v: string) {
      const d = nfse.soDigitos(v);
      if (d.length !== 14 || !nfse.documentoValido(d)) { gravar('cnpj', 'O CNPJ não confere.'); return; }
      prestador('cnpj', { cnpj: d });
    },
    definirIm(v: string) {
      const im = v.trim();
      if (!im) { gravar('im', 'Falta a inscrição municipal.'); return; }
      prestador('im', { im });
    },
    definirSimples(op: 1 | 2 | 3) {
      // fora do ME/EPP não há apuração; ao entrar nele, começa em "tudo pelo Simples"
      prestador('simples', { opSimpNac: op, regApTribSN: op === 3 ? config.prestador.regApTribSN ?? 1 : null });
    },
    definirApuracao: (a: 1 | 2 | 3) => prestador('apuracao', { regApTribSN: a }),
    definirCTribNac(v: string) {
      const d = nfse.soDigitos(v);
      if (d.length !== 6) { gravar('cTribNac', 'O código nacional tem 6 dígitos (contabilidade: 171901).'); return; }
      servico('cTribNac', { cTribNac: d });
    },
    definirCIntContrib(v: string) {
      const c = v.trim();
      if (!c) { gravar('cIntContrib', 'Falta o código do serviço na prefeitura.'); return; }
      servico('cIntContrib', { cIntContrib: c });
    },
    definirNbs(v: string) {
      const d = nfse.soDigitos(v);
      if (d.length !== 9) { gravar('nbs', 'O NBS tem 9 dígitos.'); return; }
      servico('nbs', { cNBS: d });
    },
    definirAliquota(v: string) {
      const t = v.trim().replace('%', '').replace(',', '.');
      if (!t) { servico('aliquota', { pAliq: null }); return; }
      const n = Number(t);
      if (!(n > 0 && n <= 5)) { gravar('aliquota', 'A alíquota do ISS fica entre 0 e 5%.'); return; }
      servico('aliquota', { pAliq: n });
    },
    definirObservacao: (v: string) => servico('observacao', { infoCompl: v.trim() }),

    tokenGravadoEm: cfg.tokenGravadoEm,
    token, setToken, gravandoToken,
    async gravarToken() {
      const t = token.trim();
      if (gravandoToken) return;
      if (t.length < 10) { setAvisos(a => ({ ...a, token: 'Cole o token inteiro, como o portal da prefeitura mostrou.' })); return; }
      setAvisos(a => ({ ...a, token: '' }));
      setGravandoToken(true);
      try {
        await repo.salvarToken(t, por);
        setToken('');
        toast('Token gravado.');
      } catch (err) {
        setAvisos(a => ({ ...a, token: 'Não consegui gravar: ' + (err instanceof Error ? err.message : String(err)) }));
      } finally {
        setGravandoToken(false);
      }
    },
  };
}
