import type { UUID } from "crypto";
import type { Conversation } from "./conversation";
import type { Timestamps } from "./timestamps";
import { HeaderElement } from "./markdown";

export interface WebSearch extends Timestamps {
	_id?: UUID;
	convId?: Conversation["_id"];

	prompt: string;

	searchQuery: string;
	results: WebSearchSource[];
	contextSources: WebSearchUsedSource[];
}

export interface WebSearchSource {
	title?: string;
	link: string;
}
export interface WebSearchScrapedSource extends WebSearchSource {
	page: WebSearchPage;
}
export interface WebSearchPage {
	title: string;
	siteName?: string;
	author?: string;
	description?: string;
	createdAt?: string;
	modifiedAt?: string;
	markdownTree: HeaderElement;
}

export interface WebSearchUsedSource extends WebSearchScrapedSource {
	context: string;
}

export type WebSearchMessageSources = {
	type: "sources";
	sources: WebSearchSource[];
};

// eslint-disable-next-line no-shadow
export enum WebSearchProvider {
	GOOGLE = "Google",
	YOU = "You.com",
	SEARXNG = "SearXNG",
}
