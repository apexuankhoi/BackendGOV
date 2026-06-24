# Sử dụng image Node.js gọn nhẹ (Alpine)
FROM node:18-alpine

# Set thư mục làm việc
WORKDIR /usr/src/app

# Copy package.json và cài đặt dependencies
COPY package*.json ./
RUN npm install --production

# Copy toàn bộ source code
COPY . .

# Expose port
EXPOSE 5000

# Chạy server
CMD ["node", "server.js"]
