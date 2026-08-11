import { GoogleGenerativeAI } from "@google/generative-ai";

const MODEL = "gemini-2.5-flash";

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY não configurada");
  return new GoogleGenerativeAI(apiKey);
}

export type GeminiMessage = {
  role: "user" | "model";
  parts: { text: string }[];
};

export async function askGemini(messages: GeminiMessage[]): Promise<string> {
  const client = getClient();
  const model = client.getGenerativeModel({ model: MODEL });

  if (messages.length === 1 && messages[0].role === "user") {
    const result = await model.generateContent(messages[0].parts[0].text);
    return result.response.text();
  }

  const history = messages.slice(0, -1);
  const lastMsg = messages[messages.length - 1];
  const chat = model.startChat({ history });
  const result = await chat.sendMessage(lastMsg.parts[0].text);
  return result.response.text();
}
