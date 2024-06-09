import type { WebSearchSource } from "@/lib/types/web-search";
import { isURL } from "@/lib/utils/is-url";
import { getJson, type EngineParameters } from "serpapi";

type SerpApiResponse = {
	organic_results: {
		link: string;
	}[];
};

export default async function searchWebSerpApi(query: string): Promise<WebSearchSource[]> {
	const params = {
		q: query,
		hl: "en",
		gl: "us",
		google_domain: "google.com",
		api_key: process.env.SERPAPI_KEY,
	} satisfies EngineParameters;

	// Show result as JSON
	const response = (await getJson("google", params)) as unknown as SerpApiResponse;

	return response.organic_results.filter(({ link }) => isURL(link));
}
