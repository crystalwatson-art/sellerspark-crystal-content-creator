import { createConfiguredRequestHandler } from "../src/server.js";

const handlerPromise = createConfiguredRequestHandler();

export default async function handler(request, response) {
  const requestHandler = await handlerPromise;
  return requestHandler(request, response);
}
