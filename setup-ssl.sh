#!/bin/bash

# Script để khởi tạo chứng chỉ SSL ban đầu cho dịch vụ

# Kiểm tra domain đã được cung cấp chưa
if [ "$#" -ne 1 ]; then
    echo "Sử dụng: $0 <domain>"
    echo "Ví dụ: $0 speech-api.yourdomain.com"
    exit 1
fi

# Lưu domain
domain="$1"

# Cập nhật domain trong file cấu hình Nginx
sed -i "s/speech-api\.yourdomain\.com/$domain/g" ./nginx/conf.d/default.conf

# Tạo file dummy certificate để Nginx có thể khởi động
mkdir -p ./certbot/conf/live/$domain
openssl req -x509 -nodes -newkey rsa:4096 -days 1 \
    -keyout ./certbot/conf/live/$domain/privkey.pem \
    -out ./certbot/conf/live/$domain/fullchain.pem \
    -subj "/CN=$domain" \
    -addext "subjectAltName = DNS:$domain"

# Khởi động Nginx
docker-compose up -d nginx

# Tạm dừng để đảm bảo Nginx đã khởi động
echo "Đợi Nginx khởi động..."
sleep 5

# Cấp chứng chỉ Let's Encrypt thật
docker-compose run --rm certbot certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --agree-tos \
    --no-eff-email \
    --email phdoanh285@gmail.com \
    --force-renewal \
    -d $domain

# Khởi động lại tất cả các dịch vụ
docker-compose down
docker-compose up -d

echo "Hoàn tất! Kiểm tra HTTPS trên $domain"