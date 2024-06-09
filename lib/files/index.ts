import type { Conversation } from "@/lib/types/conversation";
import type { MessageFile } from "@/lib/types/message";
import { sha256 } from "@/lib/utils/sha256";
// import { fileTypeFromBuffer } from "file-type";
import { SharedConversation } from "../types/shared-conversation";

export async function uploadFile(file: File, _conv: Conversation): Promise<MessageFile> {
	const sha = await sha256(await file.text());
	// const buffer = await file.arrayBuffer();

	// Attempt to detect the mime type of the file, fallback to the uploaded mime
	// const mime = await fileTypeFromBuffer(buffer).then((fileType) => fileType?.mime ?? file.type);

	// TODO: upload to s3
	// const upload = collections.bucket.openUploadStream(`${conv._id}-${sha}`, {
	// 	metadata: { conversation: conv._id.toString(), mime },
	// });

	// upload.write((await file.arrayBuffer()) as unknown as Buffer);
	// upload.end();

	// only return the filename when upload throws a finish event or a 20s time out occurs
	return new Promise((resolve, reject) => {
		// upload.once("finish", () =>
		// 	resolve({ type: "hash", value: sha, mime: file.type, name: file.name })
		// );
		// upload.once("error", reject);
		resolve({ type: "hash", value: sha, mime: file.type, name: file.name });
		setTimeout(() => reject(new Error("Upload timed out")), 20_000);
	});
}

// TODO: implement downloadFile from S3
export async function downloadFile(
	sha256: string,
	_convId: Conversation["_id"] | SharedConversation["_id"]
): Promise<MessageFile & { type: "base64" }> {
	// const fileId = collections.bucket.find({ filename: `${convId.toString()}-${sha256}` });
	// const file = await fileId.next();
	// if (!file) {
	// 	throw error(404, "File not found");
	// }
	// if (file.metadata?.conversation !== convId.toString()) {
	// 	throw error(403, "You don't have access to this file.");
	// }
	// const mime = file.metadata?.mime;
	// const name = file.filename;
	// const fileStream = collections.bucket.openDownloadStream(file._id);
	// const buffer = await new Promise<Buffer>((resolve, reject) => {
	// 	const chunks: Uint8Array[] = [];
	// 	fileStream.on("data", (chunk) => chunks.push(chunk));
	// 	fileStream.on("error", reject);
	// 	fileStream.on("end", () => resolve(Buffer.concat(chunks)));
	// });
	// return { type: "base64", name, value: buffer.toString("base64"), mime };
	return { type: "base64", name: "name", value: sha256, mime: "text/plain" };
}
