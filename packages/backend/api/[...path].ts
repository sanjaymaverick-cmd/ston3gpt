import * as dotenv from "dotenv";
dotenv.config();

import type { IncomingMessage, ServerResponse } from "node:http";
import { createApp } from "../src/create-app";

type ExpressHandler = (request: IncomingMessage, response: ServerResponse) => void;

let handlerPromise: Promise<ExpressHandler> | undefined;

async function getHandler(): Promise<ExpressHandler> {
  if (!handlerPromise) {
    handlerPromise = createApp().then(async (app) => {
      await app.init();
      return app.getHttpAdapter().getInstance() as ExpressHandler;
    });
  }

  return handlerPromise;
}

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  const expressHandler = await getHandler();
  return expressHandler(request, response);
}
