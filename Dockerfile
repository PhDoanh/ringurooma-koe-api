FROM node:16-slim

# Tạo thư mục ứng dụng
WORKDIR /app

# Cài đặt dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Khởi động ứng dụng
CMD ["node", "server.js"]