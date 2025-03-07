import { App } from "obsidian";

export interface SendToCanvasSettings {
    defaultFormat: "plain" | "link" | "embed";
    rememberLastCanvas: boolean;
    lastCanvasPath: string;
    startupLoadDelay: number; // Delay in seconds before loading canvas files on startup
}

export const DEFAULT_SETTINGS: SendToCanvasSettings = {
    defaultFormat: "embed",
    rememberLastCanvas: true,
    lastCanvasPath: "",
    startupLoadDelay: 5, // Default to 5 seconds
};

export type SendFormat = "plain" | "link" | "embed";
