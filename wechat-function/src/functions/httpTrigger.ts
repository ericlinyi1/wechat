import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { GoogleGenAI } from "@google/genai";

export async function httpTrigger(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const contentType = request.headers.get("content-type") || "";
    const raw = await request.text();  // <-- 最稳定
    let prompt: string | undefined;

    try {
    if (contentType.includes("application/json")) {
        const body = JSON.parse(raw || "{}") as { prompt?: string };
        prompt = body.prompt;
    } else {
        // 兼容没带 JSON header 的情况，也尝试当 JSON 解析
        const body = JSON.parse(raw || "{}") as { prompt?: string };
        prompt = body.prompt;
    }
    } catch {
    prompt = undefined;
    }

    context.log("content-type:", contentType);
    context.log("raw-body:", raw);


    if (!prompt) {
      return { status: 400, jsonBody: { error: "Missing prompt" } };
    }

    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      return { status: 500, jsonBody: { error: "API_KEY not configured on server" } };
    }

    const ai = new GoogleGenAI({ apiKey });

    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: String(prompt) }] }],
    });

    const text = result?.text ?? "";
    return { status: 200, jsonBody: { text } };
  } catch (e: any) {
    context.error(e);
    return { status: 500, jsonBody: { error: "Server error", detail: String(e?.message ?? e) } };
  }
}

app.http("httpTrigger", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: httpTrigger,
});