import { App } from "obsidian";

export interface SendToCanvasSettings {
    rememberLastCanvas: boolean;
    lastCanvasPath: string;
    useCustomBlockIdFormat: boolean; // Whether to use a custom format for block IDs
    blockIdDateFormat: string; // MomentJS format for block IDs
    appendTimestampToLinks: boolean; // Whether to append a timestamp after links and embeds
    appendTimestampFormat: string; // MomentJS format for the timestamp to append

    // Task customization
    appendTextToOpenTasks: boolean;
    openTaskAppendText: string;

    // Status bar customization
    statusBarMaxFilenameLength: number; // Maximum number of characters to display for Canvas filenames in status bar

    // Node size settings
    linkNodeWidth: number;
    linkNodeHeight: number;
    contentNodeWidth: number;
    contentNodeHeight: number;
    fileNodeWidth: number;
    fileNodeHeight: number;
}

export const DEFAULT_SETTINGS: SendToCanvasSettings = {
    rememberLastCanvas: true,
    lastCanvasPath: "",
    useCustomBlockIdFormat: false,
    blockIdDateFormat: "YYYY-MM-DDTHH-mm-ss",
    appendTimestampToLinks: false,
    appendTimestampFormat: "[📝 ]YYYY-MM-DDTHH:mm",

    // Default task customization
    appendTextToOpenTasks: false,
    openTaskAppendText: "[l:: #Canvas ]",

    // Default status bar customization
    statusBarMaxFilenameLength: 20, // Default to 20 characters before truncation

    // Default node sizes
    linkNodeWidth: 400,
    linkNodeHeight: 100,
    contentNodeWidth: 400,
    contentNodeHeight: 200,
    fileNodeWidth: 400,
    fileNodeHeight: 400,
};

export type SendFormat = "plain" | "link" | "embed";
