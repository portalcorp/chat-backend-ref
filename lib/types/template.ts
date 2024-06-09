import type { Message } from "./message";
import type { Tool, ToolResult } from "./tool";

export type ChatTemplateInput = {
	messages: Pick<Message, "from" | "content">[];
	preprompt?: string;
	tools?: Tool[];
	toolResults?: ToolResult[];
};
