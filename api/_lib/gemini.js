import { GoogleGenerativeAI } from "@google/generative-ai";

function getGeminiModelName() {
  return process.env.GEMINI_MODEL || "gemini-2.5-flash";
}

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Variavel de ambiente GEMINI_API_KEY nao configurada");
  }

  return new GoogleGenerativeAI(apiKey);
}

function getGeminiModel() {
  return getGeminiClient().getGenerativeModel({ model: getGeminiModelName() });
}

export { getGeminiClient, getGeminiModel, getGeminiModelName };
