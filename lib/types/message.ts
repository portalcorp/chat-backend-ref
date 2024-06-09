import type { MessageUpdate } from "./message-update";
import type { Timestamps } from "./timestamps";
import type { WebSearch } from "./web-search";
import type { v4 } from "uuid";

export type Message = Partial<Timestamps> & {
	from: "user" | "assistant" | "system";
	id: ReturnType<typeof v4>;
	content: string;
	updates?: MessageUpdate[];
	webSearchId?: WebSearch["_id"]; // legacy version
	webSearch?: WebSearch;
	score?: -1 | 0 | 1;
	/**
	 * Either contains the base64 encoded image data
	 * or the hash of the file stored on the server
	 **/
	files?: MessageFile[];
	interrupted?: boolean;

	// needed for conversation trees
	ancestors?: Message["id"][];

	// goes one level deep
	children?: Message["id"][];
};

export type MessageFile = {
	type: "hash" | "base64";
	name: string;
	value: string;
	mime: string;
};
