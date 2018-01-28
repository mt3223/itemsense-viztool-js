FROM node:argon
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
COPY package.json /usr/src/app
RUN npm install
RUN npm install -g gulp
COPY . /usr/src/app
RUN gulp compile
EXPOSE 3000
CMD ["npm","start"]
