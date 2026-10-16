// Senhas › Empresas (07/10/2026: "um módulo de senhas gov/certificados"): as empresas com a senha gov.br e o certificado
// (a validade, com o aviso de vencimento), o filtro e a busca. Clicar abre a janela da empresa (gov.br e Certificado).
import { Esqueleto, Icone, Segmentado, useCarregando } from '@nads/ui';
import { useState } from 'react';
import { JanelaLateral, type TopicoDaJanela } from '../janela/JanelaLateral';
import { TelaDeBloqueio } from './TelaDeBloqueio';
import { ImportarCertificados } from './ImportarCertificados';
import { SegredosDaEmpresa } from './SegredosDaEmpresa';
import { useSenhasDasEmpresas, type FiltroDeSenhas } from './useSenhasDasEmpresas';

type Topico = 'gov' | 'certificado';
const TOPICOS: TopicoDaJanela<Topico>[] = [{ id: 'gov', rotulo: 'gov.br', icone: 'usuario' }, { id: 'certificado', rotulo: 'Certificado', icone: 'lock' }];

export function SenhasDasEmpresas() {
  const vm = useSenhasDasEmpresas();
  const [topico, setTopico] = useState<Topico>('gov');
  const [importando, setImportando] = useState(false);
  useCarregando(vm.cofre.estado === 'carregando');
  if (vm.cofre.estado === 'carregando') return <Esqueleto linhas={8} />;
  // sem acesso ao cofre, só a tela de pedir acesso (13/10/2026: "não era pra tela nem abrir, era pra só ter a tela de pedir acesso")
  if (vm.cofre.estado !== 'aberto') return <TelaDeBloqueio vm={vm.cofre} />;
  const filtros: { valor: FiltroDeSenhas; rotulo: string }[] = [
    { valor: 'todas', rotulo: 'Todas · ' + vm.contagem.todas },
    { valor: 'vencendo', rotulo: 'Certificado vencendo · ' + vm.contagem.vencendo },
    { valor: 'sem', rotulo: 'Faltando · ' + vm.contagem.sem },
  ];
  return (
    <section>
      <div className="tarefas-barra-topo">
        <Segmentado valor={vm.filtro} opcoes={filtros} onMudar={vm.setFiltro} />
        <span className="tarefas-barra-espaco" />
        {vm.cofre.estado === 'aberto' && <button type="button" className="btn btn-outline" onClick={() => setImportando(true)}><Icone nome="upload" />Importar certificados</button>}
        <label className="busca-curta">
          <Icone nome="search" />
          <input type="text" placeholder="Buscar empresa" aria-label="Buscar empresa" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} />
        </label>
      </div>
      <div className="table-wrap cofre-tabela">
        <table>
          <thead><tr><th>Cód.</th><th>Empresa</th><th>gov.br</th><th>Certificado</th><th>Atualizado</th></tr></thead>
          <tbody>
            {vm.linhas.map(l => (
              <tr key={l.chave} className={vm.cofre.bloqueio ? 'cofre-bloqueado' : 'dp-linha-abre'} title={vm.cofre.bloqueio || undefined} onClick={() => { vm.abrir(l.nome, l.codigo); setTopico('gov'); }}>
                <td>{l.codigo != null && <span className="emp-cod">{l.codigo}</span>}</td>
                <td className="cofre-nome">{l.nome}</td>
                <td>{l.temGov ? <span className="badge badge-ok">Guardada</span> : <span className="pill-vazio">sem senha</span>}</td>
                <td>
                  {l.situacao === 'sem' ? <span className="pill-vazio">sem certificado</span>
                    : <span className={'badge ' + (l.situacao === 'vencido' ? 'badge-bad' : l.situacao === 'vence' ? 'badge-warn' : 'badge-ok')}>
                      {l.situacao === 'vencido' ? 'Vencido' : l.situacao === 'vence' ? 'Vence em ' + l.dias + ' dias' : 'Até ' + l.validade.split('-').reverse().join('/')}
                    </span>}
                </td>
                <td className="fraco cofre-atualizado">{l.atualizadoEm ? new Date(l.atualizadoEm).toLocaleDateString('pt-BR') + (l.atualizadoPor ? ' · ' + l.atualizadoPor.split(' ')[0] : '') : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {importando && <ImportarCertificados cofre={vm.cofre} fechar={() => setImportando(false)} />}
      {vm.aberta && (
        <JanelaLateral rotulo={vm.aberta.nome} topicos={TOPICOS} topico={topico} mudar={setTopico} fechar={vm.fechar} classe="cofre-janela" resumo={(
          <div className="usuario-quem"><b>{vm.aberta.nome}</b>{vm.aberta.codigo != null && <span className="fraco">{vm.aberta.codigo}</span>}</div>
        )}>
          <SegredosDaEmpresa vm={vm.cofre} empresa={vm.aberta.nome} codigo={vm.aberta.codigo} parte={topico} />
        </JanelaLateral>
      )}
    </section>
  );
}
