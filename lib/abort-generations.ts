import { logger } from "./logger";

export class AbortedGenerations {
	private static instance: AbortedGenerations;

	private abortedGenerations: Map<string, Date> = new Map();

	private constructor() {
		const interval = setInterval(this.updateList, 1000);

		process.on("SIGINT", () => {
			clearInterval(interval);
		});
	}

	public static getInstance(): AbortedGenerations {
		if (!AbortedGenerations.instance) {
			AbortedGenerations.instance = new AbortedGenerations();
		}

		return AbortedGenerations.instance;
	}

	public getList(): Map<string, Date> {
		return this.abortedGenerations;
	}

	private async updateList() {
		try {
			// TODO: update in DB
			// const aborts = await collections.abortedGenerations.find({}).sort({ createdAt: 1 }).toArray();
			// this.abortedGenerations = new Map(
			// 	aborts.map(({ conversationId, createdAt }) => [conversationId.toString(), createdAt])
			// );
		} catch (err) {
			logger.error(err);
		}
	}
}
