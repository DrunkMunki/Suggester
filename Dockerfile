FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN for i in $(seq 1 5); do apk update && break || sleep 5; done \
    && apk add --no-cache --virtual .build-deps python3 make g++ \
    && npm install \
    && apk del .build-deps

COPY . .

CMD ["node", "index.js"]
