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

    // Node size settings
    linkNodeWidth: number;
    linkNodeHeight: number;
    contentNodeWidth: number;
    contentNodeHeight: number;
    fileNodeWidth: number;
    fileNodeHeight: number;

    // Node positioning strategy
    nodePositionStrategy: "right" | "center" | "smart";
    
    // Enhanced node positioning settings
    rightPositionGap: number;       // Gap between nodes for right positioning
    groupPlacementEnabled: boolean; // Whether to maintain consistent positioning for sequential additions
    groupPlacementTimeout: number;  // Time in ms before resetting group placement (5000 = 5 seconds)
}

export type SendFormat = "plain" | "link" | "embed";

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

    // Default node sizes
    linkNodeWidth: 400,
    linkNodeHeight: 100,
    contentNodeWidth: 400,
    contentNodeHeight: 200,
    fileNodeWidth: 400,
    fileNodeHeight: 400,

    // Default node positioning strategy
    nodePositionStrategy: "smart",
    
    // Default enhanced positioning settings
    rightPositionGap: 300,         // Smaller default gap than original 500px
    groupPlacementEnabled: true,    // Enable group placement by default
    groupPlacementTimeout: 5000,    // 5 seconds timeout for group placement
};
