import { z } from "zod";
import express from "express";
import { models } from "@/lib/models";
import { isMessageId } from "@/lib/utils/tree/is-message-id";
import { Message } from "@/lib/types/message";
import { Conversation } from "@/lib/types/conversation";
import { buildSubtree } from "@/lib/utils/tree/build-subtree";
import { addSibling } from "@/lib/utils/tree/add-sibling";
import { addChildren } from "@/lib/utils/tree/add-children";
import { uploadFile } from "@/lib/files";
import { MessageUpdate, MessageUpdateStatus, MessageUpdateType } from "@/lib/types/message-update";
import { TextGenerationContext } from "@/lib/text-generation/types";
import { textGeneration } from "@/lib/text-generation";
import { NextRequest } from "next/server";

export const POST = async (req: NextRequest) => {
	const form = await req.formData();
	const ip = req.ip;

	const promptedAt = new Date();

	// TODO: strict conversation type check with zod
	const conv: Conversation = z.any().parse(form.get("conversation"));

	const convId = conv._id;

	const model = models.find((m) => m.id === conv.model);

	if (!model) {
		return new Response("Model not found", { status: 404 });
	}

	const {
		inputs: newPrompt,
		id: messageId,
		is_retry: isRetry,
		is_continue: isContinue,
		web_search: webSearch,
		tools: toolsPreferences,
	} = z
		.object({
			id: z.string().uuid().refine(isMessageId).optional(), // parent message id to append to for a normal message, or the message id for a retry/continue
			inputs: z.optional(
				z
					.string()
					.min(1)
					.transform((s) => s.replace(/\r\n/g, "\n"))
			),
			is_retry: z.optional(z.boolean()),
			is_continue: z.optional(z.boolean()),
			web_search: z.optional(z.boolean()),
			tools: z.record(z.boolean()).optional(),
		})
		.parse(form.get("data"));

	const inputFiles = await Promise.all(
		form
			.getAll("files")
			.filter((entry): entry is File => entry instanceof File && entry.size > 0)
			.map(async (file) => {
				const [type, ...name] = file.name.split(";");

				return {
					type: z.literal("base64").or(z.literal("hash")).parse(type),
					value: await file.text(),
					mime: file.type,
					name: name.join(";"),
				};
			})
	);

	// each file is either:
	// base64 string requiring upload to the server
	// hash pointing to an existing file
	const hashFiles = inputFiles?.filter((file) => file.type === "hash") ?? [];
	const b64Files =
		inputFiles
			?.filter((file) => file.type !== "hash")
			.map((file) => {
				const blob = Buffer.from(file.value, "base64");
				return new File([blob], file.name, { type: file.mime });
			}) ?? [];

	// check sizes
	// todo: make configurable
	if (b64Files.some((file) => file.size > 10 * 1024 * 1024)) {
		return new Response("File too large, should be <10MB", { status: 413 });
	}

	const uploadedFiles = await Promise.all(b64Files.map((file) => uploadFile(file, conv))).then(
		(files) => [...files, ...hashFiles]
	);

	// we will append tokens to the content of this message
	let messageToWriteToId: Message["id"] | undefined = undefined;
	// used for building the prompt, subtree of the conversation that goes from the latest message to the root
	let messagesForPrompt: Message[] = [];

	if (isContinue && messageId) {
		// if it's the last message and we continue then we build the prompt up to the last message
		// we will strip the end tokens afterwards when the prompt is built
		if ((conv.messages.find((msg) => msg.id === messageId)?.children?.length ?? 0) > 0) {
			return new Response("Can only continue the last message", { status: 400 });
		}
		messageToWriteToId = messageId;
		messagesForPrompt = buildSubtree(conv, messageId);
	} else if (isRetry && messageId) {
		// two cases, if we're retrying a user message with a newPrompt set,
		// it means we're editing a user message
		// if we're retrying on an assistant message, newPrompt cannot be set
		// it means we're retrying the last assistant message for a new answer

		const messageToRetry = conv.messages.find((message) => message.id === messageId);

		if (!messageToRetry) {
			return new Response("Message not found", { status: 404 });
		}

		if (messageToRetry.from === "user" && newPrompt) {
			// add a sibling to this message from the user, with the alternative prompt
			// add a children to that sibling, where we can write to
			const newUserMessageId = addSibling(
				conv,
				{
					from: "user",
					content: newPrompt,
					files: uploadedFiles,
					createdAt: new Date(),
					updatedAt: new Date(),
				},
				messageId
			);
			messageToWriteToId = addChildren(
				conv,
				{
					from: "assistant",
					content: "",
					createdAt: new Date(),
					updatedAt: new Date(),
				},
				newUserMessageId
			);
			messagesForPrompt = buildSubtree(conv, newUserMessageId);
		} else if (messageToRetry.from === "assistant") {
			// we're retrying an assistant message, to generate a new answer
			// just add a sibling to the assistant answer where we can write to
			messageToWriteToId = addSibling(
				conv,
				{ from: "assistant", content: "", createdAt: new Date(), updatedAt: new Date() },
				messageId
			);
			messagesForPrompt = buildSubtree(conv, messageId);
			messagesForPrompt.pop(); // don't need the latest assistant message in the prompt since we're retrying it
		}
	} else {
		// just a normal linear conversation, so we add the user message
		// and the blank assistant message back to back
		const newUserMessageId = addChildren(
			conv,
			{
				from: "user",
				content: newPrompt ?? "",
				files: uploadedFiles,
				createdAt: new Date(),
				updatedAt: new Date(),
			},
			messageId
		);

		messageToWriteToId = addChildren(
			conv,
			{
				from: "assistant",
				content: "",
				createdAt: new Date(),
				updatedAt: new Date(),
			},
			newUserMessageId
		);
		// build the prompt from the user message
		messagesForPrompt = buildSubtree(conv, newUserMessageId);
	}

	const messageToWriteTo = conv.messages.find((message) => message.id === messageToWriteToId);
	if (!messageToWriteTo) {
		return new Response("Failed to create message", { status: 500 });
	}

	if (messagesForPrompt.length === 0) {
		return new Response("Failed to create prompt", { status: 500 });
	}

	// TODO: update conversation in DB
	// await collections.conversations.updateOne(
	// 		{ _id: convId },
	// 		{ $set: { messages: conv.messages, title: conv.title, updatedAt: new Date() } }
	// 	);

	let doneStreaming = false;

	let lastTokenTimestamp: undefined | Date = undefined;

	// we now build the stream
	const stream = new ReadableStream({
		async start(controller) {
			messageToWriteTo.updates ??= [];
			async function update(event: MessageUpdate) {
				if (!messageToWriteTo || !conv) {
					throw Error("No message or conversation to write events to");
				}

				// Add token to content or skip if empty
				if (event.type === MessageUpdateType.Stream) {
					if (event.token === "") return;
					messageToWriteTo.content += event.token;

					// TODO: add metrics
					// // add to token total
					// MetricsServer.getMetrics().model.tokenCountTotal.inc({ model: model?.id });

					// // if this is the first token, add to time to first token
					// if (!lastTokenTimestamp) {
					// 	MetricsServer.getMetrics().model.timeToFirstToken.observe(
					// 		{ model: model?.id },
					// 		Date.now() - promptedAt.getTime()
					// 	);
					// 	lastTokenTimestamp = new Date();
					// }

					// // add to time per token
					// MetricsServer.getMetrics().model.timePerOutputToken.observe(
					// 	{ model: model?.id },
					// 	Date.now() - (lastTokenTimestamp ?? promptedAt).getTime()
					// );
					lastTokenTimestamp = new Date();
				}

				// Set the title
				else if (event.type === MessageUpdateType.Title) {
					conv.title = event.title;
					// TODO: update to DB
					// await collections.conversations.updateOne(
					// 	{ _id: convId },
					// 	{ $set: { title: conv?.title, updatedAt: new Date() } }
					// );
				}

				// Set the final text and the interrupted flag
				else if (event.type === MessageUpdateType.FinalAnswer) {
					messageToWriteTo.interrupted = event.interrupted;
					messageToWriteTo.content = initialMessageContent + event.text;

					// TODO: metrics
					// // add to latency
					// MetricsServer.getMetrics().model.latency.observe(
					// 	{ model: model?.id },
					// 	Date.now() - promptedAt.getTime()
					// );
				}

				// Add file
				else if (event.type === MessageUpdateType.File) {
					messageToWriteTo.files = [
						...(messageToWriteTo.files ?? []),
						{ type: "hash", name: event.name, value: event.sha, mime: event.mime },
					];
				}

				// Append to the persistent message updates if it's not a stream update
				if (event.type !== "stream") {
					messageToWriteTo?.updates?.push(event);
				}

				// Avoid remote keylogging attack executed by watching packet lengths
				// by padding the text with null chars to a fixed length
				// https://cdn.arstechnica.net/wp-content/uploads/2024/03/LLM-Side-Channel.pdf
				if (event.type === MessageUpdateType.Stream) {
					event = { ...event, token: event.token.padEnd(16, "\0") };
				}

				// Send the update to the client
				controller.enqueue(JSON.stringify(event) + "\n");

				// Send 4096 of spaces to make sure the browser doesn't blocking buffer that holding the response
				if (event.type === "finalAnswer") {
					controller.enqueue(" ".repeat(4096));
				}
			}

			// TODO: update to DB
			// await collections.conversations.updateOne(
			// 	{ _id: convId },
			// 	{ $set: { title: conv.title, updatedAt: new Date() } }
			// );
			messageToWriteTo.updatedAt = new Date();

			let hasError = false;
			const initialMessageContent = messageToWriteTo.content;
			try {
				const ctx: TextGenerationContext = {
					model,
					endpoint: await model.getEndpoint(),
					conv,
					messages: messagesForPrompt,
					assistant: undefined,
					isContinue: isContinue ?? false,
					webSearch: webSearch ?? false,
					toolsPreference: toolsPreferences ?? {},
					promptedAt,
					ip: ip ?? "",
					// TODO: user name
					// username: locals.user?.username,
				};
				// run the text generation and send updates to the client
				for await (const event of textGeneration(ctx)) await update(event);
			} catch (e) {
				hasError = true;
				await update({
					type: MessageUpdateType.Status,
					status: MessageUpdateStatus.Error,
					message: (e as Error).message,
				});
				console.error(e);
			} finally {
				// check if no output was generated
				if (!hasError && messageToWriteTo.content === initialMessageContent) {
					await update({
						type: MessageUpdateType.Status,
						status: MessageUpdateStatus.Error,
						message: "No output was generated. Something went wrong.",
					});
				}
			}

			// TODO: update to DB
			// await collections.conversations.updateOne(
			// 	{ _id: convId },
			// 	{ $set: { messages: conv.messages, title: conv?.title, updatedAt: new Date() } }
			// );

			// used to detect if cancel() is called bc of interrupt or just because the connection closes
			doneStreaming = true;

			controller.close();
		},
		async cancel() {
			if (doneStreaming) return;
			// TODO: update to DB
			// await collections.conversations.updateOne(
			// 	{ _id: convId },
			// 	{ $set: { messages: conv.messages, title: conv.title, updatedAt: new Date() } }
			// );
		},
	});

	// TODO: assistant stats to DB
	// if (conv.assistantId) {
	// 		await collections.assistantStats.updateOne(
	// 			{
	// 				assistantId: conv.assistantId,
	// 				"date.at": startOfHour(new Date()),
	// 				"date.span": "hour",
	// 			},
	// 			{ $inc: { count: 1 } },
	// 			{ upsert: true }
	// 		);
	// 	}

	// TODO: metrics
	// const metrics = MetricsServer.getMetrics();
	// metrics.model.messagesTotal.inc({ model: model?.id });

	// Todo: maybe we should wait for the message to be saved before ending the response - in case of errors
	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
		},
	});
};
