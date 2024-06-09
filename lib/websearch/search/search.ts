import type { WebSearchSource } from "@/lib/types/web-search";
import type { Message } from "@/lib/types/message";
import type { Assistant } from "@/lib/types/assistant";
import { getWebSearchProvider, searchWeb } from "./endpoints";
import { generateQuery } from "./generateQuery";
import { isURLStringLocal } from "@/lib/is-url-local";

import z from "zod";
import JSON5 from "json5";
import { makeGeneralUpdate } from "../update";
import type { MessageWebSearchUpdate } from "@/lib/types/message-update";
import { isURL } from "@/lib/utils/is-url";

const listSchema = z.array(z.string()).default([]);
const allowList = listSchema.parse(JSON5.parse(process.env.WEBSEARCH_ALLOWLIST ?? "[]"));
const blockList = listSchema.parse(JSON5.parse(process.env.WEBSEARCH_BLOCKLIST ?? "[]"));

export async function* search(
	messages: Message[],
	ragSettings?: Assistant["rag"],
	query?: string
): AsyncGenerator<
	MessageWebSearchUpdate,
	{ searchQuery: string; pages: WebSearchSource[] },
	undefined
> {
	if (ragSettings && ragSettings?.allowedLinks.length > 0) {
		yield makeGeneralUpdate({ message: "Using links specified in Assistant" });
		return {
			searchQuery: "",
			pages: await directLinksToSource(ragSettings.allowedLinks).then(filterByBlockList),
		};
	}

	const searchQuery = query ?? (await generateQuery(messages));
	yield makeGeneralUpdate({ message: `Searching ${getWebSearchProvider()}`, args: [searchQuery] });

	// handle the global and (optional) rag lists
	if (ragSettings && ragSettings?.allowedDomains.length > 0) {
		yield makeGeneralUpdate({ message: "Filtering on specified domains" });
	}
	const filters = buildQueryFromSiteFilters(
		[...(ragSettings?.allowedDomains ?? []), ...allowList],
		blockList
	);

	const searchQueryWithFilters = `${filters} ${searchQuery}`;
	const searchResults = await searchWeb(searchQueryWithFilters).then(filterByBlockList);

	return {
		searchQuery: searchQueryWithFilters,
		pages: searchResults,
	};
}

// ----------
// Utils
function filterByBlockList(results: WebSearchSource[]): WebSearchSource[] {
	return results.filter((result) => !blockList.some((blocked) => result.link.includes(blocked)));
}

function buildQueryFromSiteFilters(allow: string[], block: string[]) {
	return (
		allow.map((item) => "site:" + item).join(" OR ") +
		" " +
		block.map((item) => "-site:" + item).join(" ")
	);
}

async function directLinksToSource(links: string[]): Promise<WebSearchSource[]> {
	if (process.env.ENABLE_LOCAL_FETCH !== "true") {
		const localLinks = await Promise.all(links.map(isURLStringLocal));
		links = links.filter((_, index) => !localLinks[index]);
	}

	return links.filter(isURL).map((link) => ({
		link,
		title: "",
		text: [""],
	}));
}
