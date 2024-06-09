import type { Timestamps } from "./timestamps";
import type { UUID } from "crypto";

export interface User extends Timestamps {
	_id: UUID;

	username?: string;
	name: string;
	email?: string;
	avatarUrl: string | undefined;
	hfUserId: string;
	isAdmin?: boolean;
}
