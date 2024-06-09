import pino from "pino";

let options: pino.LoggerOptions = {};

if (process.env.NODE_ENV === "development") {
	options = {
		transport: {
			target: "pino-pretty",
			options: {
				colorize: true,
			},
		},
	};
}

export const logger = pino({ ...options, level: process.env.LOG_LEVEL ?? "info" });
