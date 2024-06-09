import { WebSearchProvider, type WebSearchSource } from "@/lib/types/web-search";
import searchSerper from "./endpoints/serper";
import searchSerpApi from "./endpoints/serpApi";
import searchSerpStack from "./endpoints/serpStack";
import searchYouApi from "./endpoints/youApi";
import searchWebLocal from "./endpoints/webLocal";
import searchSearxng from "./endpoints/searxng";
import searchSearchApi from "./endpoints/searchApi";

export function getWebSearchProvider() {
	if (process.env.YDC_API_KEY) return WebSearchProvider.YOU;
	if (process.env.SEARXNG_QUERY_URL) return WebSearchProvider.SEARXNG;
	return WebSearchProvider.GOOGLE;
}

/** Searches the web using the first available provider, based on the env */
export async function searchWeb(query: string): Promise<WebSearchSource[]> {
	if (process.env.USE_LOCAL_WEBSEARCH) return searchWebLocal(query);
	if (process.env.SEARXNG_QUERY_URL) return searchSearxng(query);
	if (process.env.SERPER_API_KEY) return searchSerper(query);
	if (process.env.YDC_API_KEY) return searchYouApi(query);
	if (process.env.SERPAPI_KEY) return searchSerpApi(query);
	if (process.env.SERPSTACK_API_KEY) return searchSerpStack(query);
	if (process.env.SEARCHAPI_KEY) return searchSearchApi(query);
	throw new Error(
		"No configuration found for web search. Please set USE_LOCAL_WEBSEARCH, SEARXNG_QUERY_URL, SERPER_API_KEY, YDC_API_KEY, SERPSTACK_API_KEY, or SEARCHAPI_KEY in your environment variables."
	);
}
