/**
 * Gemini adapter: one structured-output call per request, with a hard timeout, strict
 * safety settings and JSON-only replies. Model choice and fallback live in the coach.
 */
import {
  type GenerateContentParameters,
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
} from '@google/genai';
import type { ModelRequest, TextModel } from '../services/ports';

/** The part of the Gemini SDK this adapter uses, so tests can pass a fake. */
export interface GenerateClient {
  readonly models: {
    generateContent(
      params: GenerateContentParameters,
    ): Promise<{ readonly text?: string | undefined }>;
  };
}

/** A model reply that contained no usable text (blocked or empty). */
export class EmptyReplyError extends Error {
  override readonly name = 'EmptyReplyError';
}

const SAFETY = [
  HarmCategory.HARM_CATEGORY_HARASSMENT,
  HarmCategory.HARM_CATEGORY_HATE_SPEECH,
  HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
  HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
].map((category) => ({ category, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }));

/** Creates the real SDK client for an API key. */
export function geminiClient(apiKey: string): GenerateClient {
  return new GoogleGenAI({ apiKey });
}

/** Wraps a Gemini client as a TextModel that gives up after `timeoutMs`. */
export function createGeminiModel(client: GenerateClient, timeoutMs: number): TextModel {
  return {
    async generate(request: ModelRequest) {
      const reply = await client.models.generateContent({
        model: request.model,
        contents: request.prompt,
        config: {
          systemInstruction: request.system,
          responseMimeType: 'application/json',
          responseJsonSchema: request.schema,
          temperature: 0.4,
          maxOutputTokens: 2048,
          safetySettings: SAFETY,
          abortSignal: AbortSignal.timeout(timeoutMs),
        },
      });
      const text = reply.text?.trim() ?? '';
      if (text === '') throw new EmptyReplyError('Gemini returned no text');
      return text;
    },
  };
}
