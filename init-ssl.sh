#!/bin/bash
# 首次运行：获取 Let's Encrypt 证书
# 在运行此脚本之前，请确保没有任何程序占用 80 端口（如 nginx 未启动）

echo "正在通过 Certbot (Standalone) 申请证书..."

docker run -it --rm --name certbot \
  -p 80:80 \
  -v "/etc/letsencrypt:/etc/letsencrypt" \
  -v "/var/lib/letsencrypt:/var/lib/letsencrypt" \
  certbot/certbot certonly \
  --standalone \
  -d achuguniang.top \
  -d www.achuguniang.top \
  --register-unsafely-without-email \
  --agree-tos \
  --no-eff-email

echo "证书申请完成。现在可以运行 docker-compose up -d --build 启动服务了！"
