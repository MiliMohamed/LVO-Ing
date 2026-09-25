#!/bin/sh
# Préparation d'un VPS OVH neuf (Ubuntu 24.04) pour le CRM LVO. À lancer UNE fois, en root :
#   scp deploy/setup-vps.sh root@<IP>:/root/   (ou ubuntu@ puis sudo)
#   ssh root@<IP> 'DEPLOY_USER=lvo sh /root/setup-vps.sh'
#
# Pré-requis : ta clé SSH publique est déjà autorisée pour root ou ubuntu (choisie à la
# commande du VPS). Elle est recopiée vers l'utilisateur de déploiement AVANT de couper
# l'accès root / mot de passe : ne ferme pas ta session tant que tu n'as pas vérifié
# `ssh <DEPLOY_USER>@<IP>` dans un second terminal.
set -eu

DEPLOY_USER="${DEPLOY_USER:-lvo}"
SWAP_SIZE="${SWAP_SIZE:-4G}"

[ "$(id -u)" -eq 0 ] || { echo "À lancer en root (sudo)."; exit 1; }

echo "== Paquets"
export DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a
apt-get update -q
apt-get -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold upgrade -yq
apt-get install -yq ufw fail2ban unattended-upgrades curl git ca-certificates
timedatectl set-timezone Indian/Reunion

echo "== Utilisateur $DEPLOY_USER"
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  adduser --disabled-password --comment "" "$DEPLOY_USER"
fi
usermod -aG sudo "$DEPLOY_USER"
# sudo sans mot de passe : le compte n'a pas de mot de passe (connexion par clé uniquement).
echo "$DEPLOY_USER ALL=(ALL) NOPASSWD:ALL" > "/etc/sudoers.d/90-$DEPLOY_USER"
chmod 440 "/etc/sudoers.d/90-$DEPLOY_USER"

HOME_DIR="$(getent passwd "$DEPLOY_USER" | cut -d: -f6)"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$HOME_DIR/.ssh"
for src in /root/.ssh/authorized_keys /home/ubuntu/.ssh/authorized_keys; do
  [ -f "$src" ] && cat "$src" >> "$HOME_DIR/.ssh/authorized_keys"
done
[ -s "$HOME_DIR/.ssh/authorized_keys" ] || { echo "Aucune clé SSH trouvée : abandon avant de verrouiller SSH."; exit 1; }
sort -u "$HOME_DIR/.ssh/authorized_keys" -o "$HOME_DIR/.ssh/authorized_keys"
chown "$DEPLOY_USER:$DEPLOY_USER" "$HOME_DIR/.ssh/authorized_keys"
chmod 600 "$HOME_DIR/.ssh/authorized_keys"

echo "== SSH : clé uniquement, pas de root"
# Préfixe 00 : sshd garde la PREMIÈRE valeur lue ; les drop-ins cloud-init (50-…) ne doivent pas l'emporter.
cat > /etc/ssh/sshd_config.d/00-lvo-hardening.conf <<EOF
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
AllowUsers $DEPLOY_USER
EOF
sshd -t
systemctl reload ssh

echo "== Pare-feu"
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

echo "== fail2ban (sshd)"
cat > /etc/fail2ban/jail.d/sshd.local <<'EOF'
[sshd]
enabled = true
maxretry = 5
bantime = 1h
EOF
systemctl enable --now fail2ban
systemctl restart fail2ban

echo "== Mises à jour de sécurité automatiques"
dpkg-reconfigure -f noninteractive unattended-upgrades

echo "== Swap $SWAP_SIZE (marge pour les builds Next.js)"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l "$SWAP_SIZE" /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo "/swapfile none swap sw 0 0" >> /etc/fstab
fi

echo "== Docker"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
usermod -aG docker "$DEPLOY_USER"
# Docker publie ses ports en contournant ufw : seul Caddy publie (80/443), c'est voulu.

install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" /opt/lvo-crm /var/backups/lvo-crm
touch /var/log/lvo-backup.log && chown "$DEPLOY_USER" /var/log/lvo-backup.log

echo
echo "OK. Vérifie MAINTENANT dans un autre terminal : ssh $DEPLOY_USER@<IP>"
echo "Puis suis deploy/DEPLOY.md (étape « Code et secrets »)."
