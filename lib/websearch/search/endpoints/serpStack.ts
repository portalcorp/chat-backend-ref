import { isURL } from "@/lib/utils/is-url";
import type { WebSearchSource } from "@/lib/types/web-search";

type SerpStackResponse = {
	organic_results: {
		title: string;
		url: string;
		snippet?: string;
	}[];
	error?: string;
};

export default async function searchSerpStack(query: string): Promise<WebSearchSource[]> {
	const response = await fetch(
		`http://api.serpstack.com/search?access_key=${process.env.SERPSTACK_API_KEY}&query=${query}&hl=en&gl=us`,
		{ headers: { "Content-type": "application/json; charset=UTF-8" } }
	);

	const data = (await response.json()) as SerpStackResponse;

	if (!response.ok) {
		throw new Error(
			data.error ?? `SerpStack API returned error code ${response.status} - ${response.statusText}`
		);
	}

	return data.organic_results
		.filter(({ url }) => isURL(url))
		.map(({ title, url, snippet }) => ({
			title,
			link: url,
			text: snippet ?? "",
		}));
}
