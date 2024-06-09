import type { Message } from "@/lib/types/message";

export function isMessageId(id: string): id is Message["id"] {
	return id.split("-").length === 5;
}
