FROM node:22-alpine AS build

WORKDIR /workspace
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/domain/package.json packages/domain/package.json
COPY packages/domain packages/domain
COPY apps/web/package.json apps/web/package.json
COPY apps/web apps/web

RUN pnpm install --frozen-lockfile
ARG VITE_API_BASE
ENV VITE_API_BASE=${VITE_API_BASE}
RUN pnpm --filter @project/web build

FROM nginx:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/web/dist /usr/share/nginx/html
EXPOSE 80
