FROM node:14.17-alpine3.11 AS build-image
WORKDIR /usr/src/app

COPY package.json yarn.lock ./ 
RUN ["yarn", "install", "--production"]

COPY . ./ 
RUN ["yarn", "build"]

FROM node:14.17-alpine3.11
RUN ["npm", "install", "-g", "--unsafe-perm", "pm2"]
WORKDIR /usr/src/app
COPY --from=build-image /usr/src/app/node_modules ./node_modules
COPY --from=build-image /usr/src/app/build ./build
CMD ["pm2-runtime", "./build/main.js"]
