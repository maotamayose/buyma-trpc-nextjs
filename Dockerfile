# Dockerfile
FROM node:20-alpine

# 作業ディレクトリの作成
WORKDIR /app

# 依存ファイルのコピーとインストール
COPY package*.json ./
RUN npm install

# アプリのコピー
COPY . .

# 開発用ポート
EXPOSE 3000

# 開発起動（後で変更可）
CMD ["npm", "run", "dev"]
