FROM node:latest

RUN mkdir -p /usr/src/app/
WORKDIR /usr/src/app/

COPY package.json .
RUN npm install

COPY . .

RUN chmod +x /usr/src/app/run.sh

EXPOSE 3000

ENTRYPOINT ["/usr/src/app/run.sh"]
