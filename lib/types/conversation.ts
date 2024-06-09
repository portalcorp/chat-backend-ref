import type { UUID } from "crypto";
import type { Message } from "./message";
import type { Timestamps } from "./timestamps";
import type { User } from "./user";
import type { Assistant } from "./assistant";

export interface Conversation extends Timestamps {
	_id: UUID;

	sessionId?: string;
	userId?: User["_id"];

	model: string;
	embeddingModel: string;

	title: string;
	rootMessageId?: Message["id"];
	messages: Message[];

	meta?: {
		fromShareId?: string;
	};

	preprompt?: string;
	assistantId?: Assistant["_id"];

	userAgent?: string;
}
