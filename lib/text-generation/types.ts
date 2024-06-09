import type { ProcessedModel } from "../models";
import type { Endpoint } from "../endpoints";
import type { Conversation } from "@/lib/types/conversation";
import type { Message } from "@/lib/types/message";
import type { Assistant } from "@/lib/types/assistant";

export interface TextGenerationContext {
	model: ProcessedModel;
	endpoint: Endpoint;
	conv: Conversation;
	messages: Message[];
	assistant?: Pick<Assistant, "rag" | "dynamicPrompt" | "generateSettings">;
	isContinue: boolean;
	webSearch: boolean;
	toolsPreference: Record<string, boolean>;
	promptedAt: Date;
	ip: string;
	username?: string;
}
