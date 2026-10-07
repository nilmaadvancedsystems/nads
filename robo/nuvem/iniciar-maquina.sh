#!/bin/bash
# Prepara a máquina do Google onde o robô roda (e2-micro, faixa gratuita).
#
# O Google executa este arquivo como root a cada vez que a máquina liga. Ele
# pode rodar quantas vezes for: o que já está feito, fica como está.
#
# O que ele faz:
#   1. cria o usuário "robo" (o robô não roda como root);
#   2. instala o Node na mesma versão do PC do escritório;
#   3. baixa o código do GitHub (o repositório do nads, pasta robo/, ramo
#      desenvolvimento) e instala as dependências;
#   4. na primeira vez, grava as credenciais que vieram nos metadados da
#      máquina (segredo-*) — depois disso elas são apagadas de lá e ficam só
#      no disco, legíveis apenas pelo usuário "robo";
#   5. registra o robô como serviço do sistema, que religa sozinho se cair;
#   6. liga um "interruptor" que confere os metadados a cada minuto:
#        robo-ligado = sim      liga o robô; qualquer outra coisa, desliga
#        robo-versao = (texto)  quando muda, baixa o código novo e reinicia
#      É assim que o robô é ligado, desligado e atualizado sem ninguém
#      precisar entrar na máquina.
#   7. o FGTS Digital (07/10/2026): o navegador (Chromium) e, quando o
#      certificado do escritório chega pelos metadados, a importação dele para
#      o navegador do usuário "robo" (ver robo/fgts-digital.js).
#
# O robô morava no repositório do Entregas (pasta scripts/) até 07/10/2026,
# quando foi movido para o nads (pasta robo/). Na primeira partida depois da
# troca, este arquivo copia as credenciais e o estado que já estavam no disco
# (/opt/robo/Entregas/scripts) para a pasta nova, sem pedir nada de novo.
#
# Nada aqui é segredo: as credenciais chegam pelos metadados, nunca por este
# arquivo, que está no repositório público.
set -u
NODE_VERSAO=v24.18.0
BASE=/opt/robo
REPO=https://github.com/nilmaadvancedsystems/nads.git
RAMO=desenvolvimento
CODIGO=$BASE/nads
SCRIPTS=$CODIGO/robo
ANTIGO=$BASE/Entregas/scripts
META=http://metadata.google.internal/computeMetadata/v1/instance/attributes
meta() { curl -sf -H 'Metadata-Flavor: Google' "$META/$1"; }

id robo >/dev/null 2>&1 || useradd --system --create-home --home-dir /home/robo --shell /usr/sbin/nologin robo
mkdir -p "$BASE/backup/banco"

# 1 GB de memória é pouco pra instalar dependência; a troca em disco evita
# que a instalação morra no meio.
if [ ! -f /swapfile ]; then
  fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

command -v git >/dev/null || { apt-get update -q && apt-get install -y -q git; }
# o navegador do FGTS Digital e a ferramenta que põe o certificado nele
if ! command -v chromium >/dev/null || ! command -v pk12util >/dev/null; then
  apt-get update -q && apt-get install -y -q chromium libnss3-tools fonts-liberation >/dev/null 2>&1 \
    || echo "iniciar-maquina: não consegui instalar o Chromium (o FGTS fica desligado)" > /dev/console
fi

if [ ! -x /opt/node/bin/node ] || [ "$(/opt/node/bin/node -v)" != "$NODE_VERSAO" ]; then
  curl -sfL "https://nodejs.org/dist/$NODE_VERSAO/node-$NODE_VERSAO-linux-x64.tar.xz" -o /tmp/node.tar.xz
  rm -rf /opt/node && mkdir -p /opt/node
  tar -xJf /tmp/node.tar.xz -C /opt/node --strip-components=1 && rm -f /tmp/node.tar.xz
fi
export PATH=/opt/node/bin:$PATH

if [ ! -d "$CODIGO/.git" ]; then
  git clone -q --depth 50 --branch "$RAMO" "$REPO" "$CODIGO"
fi
# A troca do Entregas para o nads: o que não é código (credenciais, memória do
# robô, registros) vem da pasta antiga, sem sobrescrever o que já houver aqui.
if [ -d "$ANTIGO" ] && [ ! -f "$SCRIPTS/.migrado-do-entregas" ]; then
  ( cd "$ANTIGO" && git -C "$BASE/Entregas" ls-files --others -- scripts \
      | sed 's#^scripts/##' | grep -v '^node_modules/' \
      | while IFS= read -r f; do [ -e "$SCRIPTS/$f" ] || { mkdir -p "$SCRIPTS/$(dirname "$f")"; cp -p "$f" "$SCRIPTS/$f"; }; done )
  date -Is > "$SCRIPTS/.migrado-do-entregas"
  echo "iniciar-maquina: credenciais e estado copiados de $ANTIGO" > /dev/console
fi
chown -R robo:robo "$BASE"
if [ ! -d "$SCRIPTS/node_modules" ]; then
  sudo -u robo env PATH="$PATH" npm ci --omit=dev --no-audit --no-fund --prefix "$SCRIPTS" >/dev/null 2>&1 \
    || sudo -u robo env PATH="$PATH" npm install --omit=dev --no-audit --no-fund --prefix "$SCRIPTS" >/dev/null 2>&1
fi

# Credenciais: só gravadas se ainda não existem no disco.
gravar_segredo() {   # $1 = chave nos metadados, $2 = arquivo, $3 = "base64" se o valor vem em base64
  local destino="$SCRIPTS/$2"
  [ -s "$destino" ] && return
  local valor; valor=$(meta "$1") || return
  [ -n "$valor" ] || return
  umask 077
  if [ "${3:-}" = "base64" ]; then printf '%s' "$valor" | base64 -d > "$destino"; else printf '%s' "$valor" > "$destino"; fi
  chown robo:robo "$destino"; chmod 600 "$destino"
}
gravar_segredo segredo-gmail-cliente gmail_oauth_client.json
gravar_segredo segredo-gmail-token   gmail_token.json
gravar_segredo segredo-gemini        gemini_key.json
# o certificado e-CNPJ do escritório (o .pfx em base64) e a senha dele, para o FGTS Digital
gravar_segredo segredo-fgts-certificado fgts_certificado.pfx base64
gravar_segredo segredo-fgts-senha       fgts_certificado.senha

# O certificado no navegador do robô: importa para o banco de certificados do
# usuário "robo" (o Chromium do Linux lê dali) e diz ao Chromium para escolher
# esse certificado sozinho no login do gov.br. Refaz quando o arquivo muda.
PFX="$SCRIPTS/fgts_certificado.pfx"
if [ -s "$PFX" ] && command -v pk12util >/dev/null; then
  NSS=/home/robo/.pki/nssdb
  marca=$(sha256sum "$PFX" | cut -c1-16)
  if [ "$(cat "$NSS/.fgts-importado" 2>/dev/null)" != "$marca" ]; then
    rm -rf "$NSS" && sudo -u robo mkdir -p "$NSS"
    sudo -u robo certutil -N -d "sql:$NSS" --empty-password
    if sudo -u robo pk12util -i "$PFX" -d "sql:$NSS" -w "$SCRIPTS/fgts_certificado.senha" >/dev/null 2>&1; then
      echo "$marca" | sudo -u robo tee "$NSS/.fgts-importado" >/dev/null
      echo "iniciar-maquina: certificado do FGTS importado" > /dev/console
    else
      echo "iniciar-maquina: o certificado do FGTS não abriu com a senha dos metadados" > /dev/console
    fi
  fi
  mkdir -p /etc/chromium/policies/managed
  cat > /etc/chromium/policies/managed/fgts.json <<'POLITICA'
{ "AutoSelectCertificateForUrls": [
  "{\"pattern\":\"https://[*.]acesso.gov.br\",\"filter\":{}}",
  "{\"pattern\":\"https://[*.]sistema.gov.br\",\"filter\":{}}"
] }
POLITICA
fi

cat > /etc/systemd/system/robo.service <<EOF
[Unit]
Description=Robo do escritorio - Nilma Contabilidade
After=network-online.target
Wants=network-online.target

[Service]
User=robo
WorkingDirectory=$SCRIPTS
Environment=PATH=/opt/node/bin:/usr/bin:/bin
Environment=TZ=America/Sao_Paulo
Environment=ROBO_NA_NUVEM=1
Environment=ROBO_NOME=nuvem-google
Environment=USAR_DRIVE_API=1
Environment=BACKUP_PASTA=$BASE/backup/banco
Environment=FGTS_CHROMIUM=/usr/bin/chromium
ExecStart=/opt/node/bin/node vigia-robo.js --a-cada 120
Restart=always
RestartSec=30
# O registro vai também pra porta serial, que dá pra ler de fora pela API do
# Google sem entrar na máquina.
StandardOutput=journal+console
StandardError=journal+console
KillSignal=SIGTERM
TimeoutStopSec=15

[Install]
WantedBy=multi-user.target
EOF

cat > /usr/local/bin/robo-interruptor <<'EOF'
#!/bin/bash
META=http://metadata.google.internal/computeMetadata/v1/instance/attributes
meta() { curl -sf -H 'Metadata-Flavor: Google' "$META/$1"; }
CODIGO=/opt/robo/nads
SCRIPTS=$CODIGO/robo
export PATH=/opt/node/bin:$PATH
ligado=$(meta robo-ligado)
versao=$(meta robo-versao)
if [ -n "$versao" ] && [ "$versao" != "$(cat /opt/robo/versao 2>/dev/null)" ]; then
  echo "robo-interruptor: atualizando para $versao" > /dev/console
  sudo -u robo git -C "$CODIGO" pull -q --ff-only \
    && sudo -u robo env PATH="$PATH" npm install --omit=dev --no-audit --no-fund --prefix "$SCRIPTS" >/dev/null 2>&1 \
    && echo "$versao" > /opt/robo/versao \
    && { [ "$ligado" = "sim" ] && systemctl restart robo; true; }
fi
if [ "$ligado" = "sim" ]; then
  systemctl is-active -q robo || { echo "robo-interruptor: ligando" > /dev/console; systemctl start robo; }
else
  systemctl is-active -q robo && { echo "robo-interruptor: desligando" > /dev/console; systemctl stop robo; }
fi
exit 0
EOF
chmod 755 /usr/local/bin/robo-interruptor

cat > /etc/systemd/system/robo-interruptor.service <<'EOF'
[Unit]
Description=Confere nos metadados se o robo deve estar ligado
[Service]
Type=oneshot
ExecStart=/usr/local/bin/robo-interruptor
EOF
cat > /etc/systemd/system/robo-interruptor.timer <<'EOF'
[Unit]
Description=Interruptor do robo, a cada minuto
[Timer]
OnBootSec=30
OnUnitActiveSec=60
[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
# O robô não liga sozinho na partida da máquina: quem decide é o interruptor.
systemctl disable -q robo 2>/dev/null
systemctl enable -q --now robo-interruptor.timer
echo "iniciar-maquina: pronto ($(date -Is))" > /dev/console
