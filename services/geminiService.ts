
import { GoogleGenAI, Type } from "@google/genai";
import { ToneType, AnalysisResult } from "../types";

const MAX_RETRIES = 3;
const INITIAL_BACKOFF = 1000;

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// 优先读取 vite.config.ts 中 define 的环境变量
const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const analyzeChatContent = async (
  content: string, 
  tone: ToneType, 
  isImage: boolean = false,
  modelName: string = 'gemini-3-flash-preview'
): Promise<AnalysisResult> => {

  //const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const ai = new GoogleGenAI({
  apiKey: import.meta.env.VITE_API_KEY,});
  
console.log("MODE", import.meta.env.MODE);
console.log("VITE_API_KEY exists?", !!import.meta.env.VITE_API_KEY);

  const systemInstruction = `你是一个具备深度社交洞察力的微信超级助手。
你的核心任务是：自动分析聊天视窗，实时识别对方的情绪，并从以下五个人格中【自动切换】最合适的一个进行回复：
你的核心任务是：自动分析聊天视窗，实时识别对方的情绪，并基于用户偏好【${tone}】进行回复。

可选人格库：
- 专业稳重 (对应：专业稳重)
- 幽默风趣 (对应：幽默风趣)
- 温柔共情 (对应：温柔共情)
- 随性自然 (对应：随性自然)
- 直截了当 (对应：直截了当)

核心逻辑：
1. 【视窗识别】：右侧为“我”，左侧为“对方”。
2. 【情绪引擎】：深入分析对方最后一条消息的情绪（如：焦虑、兴奋、冷淡、愤怒等）。
2. 【情绪引擎】：深入分析对方最后一条消息的情绪。
3. 【人格自适应】：
   - 必须根据“情绪引擎”的结果，从上述五个中选择最合适的【detectedTone】。
   - 优先使用用户设定的风格：【${tone}】。
   - 仅当该风格与当前情绪严重冲突时（例如对方极度悲伤时使用幽默风趣），才从库中自动切换为更合适的风格。
   - 将最终使用的风格填入 detectedTone。
4. 【回复执行】：
   - 风格：字数控制在25字以内。
   - 语气：口语化，像真人微信聊天。
   - 如果最后一条是“我”发的，shouldReply 设置为 false。

必须严格返回 JSON 格式：
{
  "summary": "简短摘要",
  "emotionalTone": "识别到的对方情绪",
  "intent": "对方意图",
  "confidence": 95,
  "shouldReply": true,
  "bestReply": "回复内容",
  "explanation": "切换人格的原因",
  "lastFriendMessage": "对方最后消息内容",
  "detectedTone": "专业稳重" | "幽默风趣" | "温柔共情" | "随性自然" | "直截了当"
}`;

  const config = {
    systemInstruction,
    responseMimeType: "application/json",
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING },
        emotionalTone: { type: Type.STRING },
        intent: { type: Type.STRING },
        confidence: { type: Type.INTEGER },
        shouldReply: { type: Type.BOOLEAN },
        bestReply: { type: Type.STRING },
        explanation: { type: Type.STRING },
        lastFriendMessage: { type: Type.STRING },
        detectedTone: { 
          type: Type.STRING,
          description: "选定的人格类型名称"
        }
      },
      required: ["summary", "emotionalTone", "intent", "confidence", "shouldReply", "bestReply", "explanation", "lastFriendMessage", "detectedTone"]
    }
  };

  let retryCount = 0;

  const performRequest = async (): Promise<AnalysisResult> => {
    try {
      let response;
      if (isImage) {
        const base64Data = content.includes(',') ? content.split(',')[1] : content;
        response = await ai.models.generateContent({
          model: modelName,
          contents: { 
            parts: [
              { inlineData: { mimeType: 'image/jpeg', data: base64Data } }, 
              { text: "扫描视窗。识别情绪、自动匹配人格并生成回复。" }
            ] 
          },
          config
        });
      } else {
        response = await ai.models.generateContent({
          model: modelName,
          contents: `对话内容：\n${content}`,
          config
        });
      }
      
      const text = response.text || '{}';
      return JSON.parse(text) as AnalysisResult;
    } catch (error: any) {
      if (error?.message?.includes('429') || error?.status === 429 || error?.message?.includes('RESOURCE_EXHAUSTED')) {
        if (retryCount < MAX_RETRIES) {
          retryCount++;
          const waitTime = INITIAL_BACKOFF * Math.pow(2, retryCount - 1);
          await delay(waitTime);
          return performRequest();
        }
      }
      throw error;
    }
  };

  return performRequest();
};
