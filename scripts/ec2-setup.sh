#!/bin/bash
set -e

# ==============================================================================
# Fixpair Backend - AWS EC2 Automated Setup Script (Ubuntu 22.04 / 24.04 LTS)
# ==============================================================================

echo "=========================================================="
echo " Starting Fixpair Backend Server Setup on EC2..."
echo "=========================================================="

DOMAIN=$1
EMAIL=$2

# 1. Update and Upgrade System Packages
echo "--> Updating system packages..."
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git build-essential ufw software-properties-common

# 2. Setup 2GB Swap Space (Prevents memory crash during TypeScript build)
if [ ! -f /swapfile ]; then
    echo "--> Creating 2GB Swap file..."
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    echo " Swap memory configured successfully."
else
    echo " Swap file already exists."
fi

# 3. Install Node.js 20 LTS and npm
echo "--> Installing Node.js 20 LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"

# 4. Install PM2 globally
echo "--> Installing PM2..."
sudo npm install -g pm2
sudo pm2 startup systemd -u ubuntu --hp /home/ubuntu || true

# 5. Install Nginx and Certbot
echo "--> Installing Nginx and Certbot (SSL)..."
sudo apt install -y nginx certbot python3-certbot-nginx

# 6. Configure Firewall (UFW)
echo "--> Configuring Firewall..."
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

# 7. Create project directory and set permissions
echo "--> Setting up directory /var/www/fixpair-backend..."
sudo mkdir -p /var/www/fixpair-backend
sudo chown -R ubuntu:ubuntu /var/www

# 8. Configure Nginx Reverse Proxy with Socket.IO support
NGINX_CONF="/etc/nginx/sites-available/fixpair"
SERVER_NAME=${DOMAIN:-"_"}

echo "--> Writing Nginx configuration for: $SERVER_NAME"
sudo bash -c "cat > $NGINX_CONF" <<EOF
server {
    listen 80;
    server_name $SERVER_NAME;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Socket.IO WebSocket Support
    location /socket.io/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/fixpair /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

# 9. SSL Certificate Setup if Domain is provided
if [ -n "$DOMAIN" ] && [ "$DOMAIN" != "_" ]; then
    echo "--> Setting up SSL Certificate for domain: $DOMAIN..."
    if [ -n "$EMAIL" ]; then
        sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect || true
    else
        sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect || true
    fi
else
    echo "ℹ No domain supplied. Run later with domain: sudo certbot --nginx -d yourdomain.com"
fi

echo "=========================================================="
echo " Server initialization completed successfully!"
echo " Next step: Deploy your project via GitHub Actions"
echo "=========================================================="
