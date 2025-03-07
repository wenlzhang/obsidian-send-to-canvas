import { App } from "obsidian";

export interface PluginSettings {
    defaultFormat: string; // 'plain', 'link', 'embed'
    rememberLastCanvas: boolean;
    lastCanvasPath: string;
    includeTagsInSend: boolean;
    includeTaskPropertiesInSend: boolean;
}

export const DEFAULT_SETTINGS: PluginSettings = {
    defaultFormat: "plain",
    rememberLastCanvas: true,
    lastCanvasPath: "",
    includeTagsInSend: true,
    includeTaskPropertiesInSend: true,
};

export type SendFormat = "plain" | "link" | "embed";
