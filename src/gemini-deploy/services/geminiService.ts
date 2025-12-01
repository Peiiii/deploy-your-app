import { GoogleGenAI, Type } from "@google/genai";
import { APP_CONFIG, SECURITY_CONSTANTS } from "../constants";

// This service simulates the backend "Agent" that would analyze user code 
// and rewrite it to use the secure proxy entrypoint instead of direct API calls.

export const secureCodeForDeployment = async (
  apiKey: string,
  sourceCode: string,
  proxyEntrypoint: string
): Promise<{ refactoredCode: string; explanation: string }> => {
  
  if (!apiKey) {
    throw new Error("API Key is required to perform AI analysis.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const systemPrompt = `
    ${SECURITY_CONSTANTS.SYSTEM_PROMPT_ROLE}
    Your task is to analyze a snippet of React/TypeScript code that initializes the Google GenAI SDK.
    
    The goal is to modify the code to use a secure Proxy Base URL instead of connecting directly to Google's servers.
    This hides the real API key in the backend proxy.

    1. Detect where 'new GoogleGenAI' or similar initialization happens.
    2. Rewrite the initialization to include 'baseUrl: "${proxyEntrypoint}"'.
    3. If the code uses 'process.env.API_KEY', keep it or replace it with a placeholder string "${SECURITY_CONSTANTS.PROXY_KEY_PLACEHOLDER}" since the proxy handles auth.
    4. Return the result in JSON format.
  `;

  try {
    const response = await ai.models.generateContent({
      model: APP_CONFIG.DEFAULT_AI_MODEL,
      contents: `Here is the source code:\n\n${sourceCode}`,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            refactoredCode: {
              type: Type.STRING,
              description: "The modified source code using the proxy url.",
            },
            explanation: {
              type: Type.STRING,
              description: "A brief explanation of what was changed for security.",
            },
          },
          required: ["refactoredCode", "explanation"],
        },
      },
    });

    // The SDK's `.text` can be typed as possibly undefined in strict mode.
    const raw = (response as { text?: string }).text ?? '';

    const result = JSON.parse(raw);
    return result;
  } catch (error) {
    console.error("Gemini analysis failed:", error);
    throw new Error("Failed to analyze code securely. Please check your API key.");
  }
};
