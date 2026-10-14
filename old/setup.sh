#!/bin/bash
set -e

REPO_DIR="/srv/cammy-the-cat.com"
SHELL_DIR="/srv/shell_website"
NGINX_CONF="/etc/nginx/sites-available/cammy-the-cat.com"

echo "==> Setting up cammy-the-cat.com..."

if [ -f "$REPO_DIR/nginx.conf" ]; then
    echo "==> Linking nginx config..."
    ln -sf "$REPO_DIR/nginx.conf" "$NGINX_CONF"
    ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/cammy-the-cat.com
else
    echo "==> Writing nginx config..."
    cat > "$NGINX_CONF" <<EOF
server {
    listen 80;
    server_name cammy-the-cat.com www.cammy-the-cat.com;

    root $REPO_DIR;
    index index.html;

    location / {
        try_files \$uri \$uri/ =404;
    }
}

server {
    listen 80;
    server_name shell.cammy-the-cat.com;

    root $SHELL_DIR;
    index index.html;

    location / {
        try_files \$uri \$uri/ =404;
    }
}
EOF
    ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/cammy-the-cat.com
fi

echo "==> cammy-the-cat.com done."