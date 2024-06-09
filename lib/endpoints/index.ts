import { Message } from "@/lib/types/message";
import { Conversation } from "@/lib/types/conversation";
import { Tool, ToolCall, ToolResult } from "@/lib/types/tool";
import type { TextGenerationStreamOutput, TextGenerationStreamToken } from "@huggingface/inference";
import { z } from "zod";
import { Model } from "@/lib/types/model";
import { endpointOAIParametersSchema, endpointOai } from "./openai";
import { endpointTgi, endpointTgiParametersSchema } from "./tgi";

export type EndpointMessage = Omit<Message, "id">;

// parameters passed when generating text
export interface EndpointParameters {
	messages: EndpointMessage[];
	preprompt?: Conversation["preprompt"];
	continueMessage?: boolean; // used to signal that the last message will be extended
	generateSettings?: Partial<Model["parameters"]>;
	tools?: Tool[];
	toolResults?: ToolResult[];
	isMultimodal?: boolean;
}

interface CommonEndpoint {
	weight: number;
}
type TextGenerationStreamOutputWithTools = TextGenerationStreamOutput & {
	token: TextGenerationStreamToken & { toolCalls?: ToolCall[] };
};
// type signature for the endpoint
export type Endpoint = (
	params: EndpointParameters
) => Promise<AsyncGenerator<TextGenerationStreamOutputWithTools, void, void>>;

// generator function that takes in parameters for defining the endpoint and return the endpoint
export type EndpointGenerator<T extends CommonEndpoint> = (parameters: T) => Endpoint;

export const endpoints = {
	tgi: endpointTgi,
	// anthropic: endpointAnthropic,
	// anthropicvertex: endpointAnthropicVertex,
	// aws: endpointAws,
	openai: endpointOai,
	// llamacpp: endpointLlamacpp,
	// ollama: endpointOllama,
	// vertex: endpointVertex,
	// cloudflare: endpointCloudflare,
	// cohere: endpointCohere,
	// langserve: endpointLangserve,
};

export const endpointSchema = z.discriminatedUnion("type", [
	// endpointAnthropicParametersSchema,
	// endpointAnthropicVertexParametersSchema,
	// endpointAwsParametersSchema,
	endpointOAIParametersSchema,
	endpointTgiParametersSchema,
	// endpointLlamacppParametersSchema,
	// endpointOllamaParametersSchema,
	// endpointVertexParametersSchema,
	// endpointCloudflareParametersSchema,
	// endpointCohereParametersSchema,
	// endpointLangserveParametersSchema,
]);
