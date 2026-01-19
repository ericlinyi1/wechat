import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { GoogleGenAI } from "@google/genai";

export async function listModels(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) return { status: 500, jsonBody: { error: "API_KEY not configured on server" } };

    const ai = new GoogleGenAI({ apiKey });

    // @google/genai 里一般是 ai.models.list()
    const modelsPager = await ai.models.list();
    const models: any[] = [];
    for await (const model of modelsPager) {
      models.push(model);
    }

    // 只返回必要字段，避免太长
    const simplified = models.map((m: any) => ({
      name: m.name,
      displayName: m.displayName,
      supportedGenerationMethods: m.supportedGenerationMethods,
    }));

    return { status: 200, jsonBody: { models: simplified } };
  } catch (e: any) {
    context.error(e);
    return { status: 500, jsonBody: { error: "Server error", detail: String(e?.message ?? e) } };
  }
}

app.http("listModels", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: listModels,
});
