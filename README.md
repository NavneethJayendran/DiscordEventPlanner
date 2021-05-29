# Setup

## Install Dependencies

```shell
yarn install
```

## Create Env Files

```shell
echo 'ENV=dev' >> .env.dev
echo 'ENV=prod' >> .env
```

You also need to set the TOKEN field to the Discord auth token.

```shell
echo 'TOKEN=mytokenvalue' >> .env.dev
echo 'TOKEN=mytokenvalue' >> .env
```

## Run with Yarn

```shell
yarn run start:dev  # run in dev mode (recommended outside AWS environment to avoid double-response from dev bots)
yarn run start      # run in prod mode
```

# Build Docker Image

Using the Docker image in prod is preferred compared to using the Yarn script. Uploading the image to AWS is out of
scope of this README. But the image may be built as follows.

```shell
docker build .
```
