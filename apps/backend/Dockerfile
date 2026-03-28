FROM node:22-alpine
WORKDIR /app

COPY package.json ./
COPY apps/backend/package.json ./apps/backend/package.json
RUN npm install --workspace @trasa/backend

COPY apps/backend ./apps/backend
WORKDIR /app/apps/backend
RUN npx prisma generate

EXPOSE 4000
CMD ["npm", "run", "dev"]
