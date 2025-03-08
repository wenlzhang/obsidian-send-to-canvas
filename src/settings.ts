import { App } from "obsidian";

export interface SendToCanvasSettings {
    defaultFormat: "plain" | "link" | "embed";
    rememberLastCanvas: boolean;
    lastCanvasPath: string;
    startupLoadDelay: number; // Delay in seconds before loading canvas files on startup
    useCustomBlockIdFormat: boolean; // Whether to use a custom format for block IDs
    blockIdDateFormat: string; // MomentJS format for block IDs
    appendTimestampToLinks: boolean; // Whether to append a timestamp after links and embeds
    appendTimestampFormat: string; // MomentJS format for the timestamp to append
}

export const DEFAULT_SETTINGS: SendToCanvasSettings = {
    defaultFormat: "embed",
    rememberLastCanvas: true,
    lastCanvasPath: "",
    startupLoadDelay: 5, // Default to 5 seconds
    useCustomBlockIdFormat: false,
    blockIdDateFormat: "YYYY-MM-DDTHH-mm-ss",
    appendTimestampToLinks: false,
    appendTimestampFormat: "[📝 ]YYYY-MM-DDTHH:mm",
};

export type SendFormat = "plain" | "link" | "embed";
