import { App } from "obsidian";

export interface PluginSettings {
    defaultFormat: string; // 'plain', 'link', 'embed'
    rememberLastCanvas: boolean;
    lastCanvasPath: string;
    includeTagsInSend: boolean;
    includeTaskPropertiesInSend: boolean;
    startupLoadDelay: number; // Delay in seconds before loading canvas files on startup
}

export const DEFAULT_SETTINGS: PluginSettings = {
    defaultFormat: "plain",
    rememberLastCanvas: true,
    lastCanvasPath: "",
    includeTagsInSend: true,
    includeTaskPropertiesInSend: true,
    startupLoadDelay: 5, // Default to 5 seconds
};

export type SendFormat = "plain" | "link" | "embed";
