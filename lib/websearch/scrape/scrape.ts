import type { WebSearchScrapedSource, WebSearchSource } from "@/lib/types/web-search";
import type { MessageWebSearchUpdate } from "@/lib/types/message-update";
import { withPage } from "./playwright";

import { spatialParser } from "./parser";
import { htmlToMarkdownTree } from "../markdown/tree";
import { timeout } from "@/lib/utils/timeout";
import { makeGeneralUpdate } from "../update";
import { logger } from "@/lib/logger";

export const scrape = (maxCharsPerElem: number) =>
	async function* (
		source: WebSearchSource
	): AsyncGenerator<MessageWebSearchUpdate, WebSearchScrapedSource | undefined, undefined> {
		try {
			// TODO: metrics
			// const startTime = Date.now();
			// MetricsServer.getMetrics().webSearch.pageFetchCount.inc();

			const page = await scrapeUrl(source.link, maxCharsPerElem);

			// TODO: metrics
			// MetricsServer.getMetrics().webSearch.pageFetchDuration.observe(Date.now() - startTime);

			yield makeGeneralUpdate({
				message: "Browsing webpage",
				args: [source.link],
			});
			return { ...source, page };
		} catch (e) {
			// TODO: metrics
			// MetricsServer.getMetrics().webSearch.pageFetchCountError.inc();
			logger.debug(`Error scraping webpage: ${source.link}`, { error: e });
		}
	};

export async function scrapeUrl(url: string, maxCharsPerElem: number) {
	return withPage(url, async (page, res) => {
		if (!res) throw Error("Failed to load page");

		// Check if it's a non-html content type that we can handle directly
		// TODO: direct mappings to markdown can be added for markdown, csv and others
		const contentType = res.headers()["content-type"] ?? "";
		if (
			contentType.includes("text/plain") ||
			contentType.includes("text/markdown") ||
			contentType.includes("application/json") ||
			contentType.includes("application/xml") ||
			contentType.includes("text/csv")
		) {
			const title = await page.title();
			const content = await page.content();
			return {
				title,
				markdownTree: htmlToMarkdownTree(
					title,
					[{ tagName: "p", attributes: {}, content: [content] }],
					maxCharsPerElem
				),
			};
		}

		const scrapedOutput = await timeout(page.evaluate(spatialParser), 2000)
			.then(({ elements, ...parsed }) => ({
				...parsed,
				markdownTree: htmlToMarkdownTree(parsed.title, elements, maxCharsPerElem),
			}))
			.catch((cause) => {
				throw Error("Parsing failed", { cause });
			});
		return scrapedOutput;
	});
}
