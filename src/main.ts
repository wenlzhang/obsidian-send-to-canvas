import {
    Plugin,
    TFile,
    Notice,
    Menu,
    MenuItem,
    MarkdownView,
    Editor,
    EditorPosition,
    EditorSelection,
    FuzzySuggestModal,
} from "obsidian";
import { SettingsTab } from "./settingsTab";
import { PluginSettings, DEFAULT_SETTINGS, SendFormat } from "./settings";
import { BlockReferenceUtils } from "./utils";

// Canvas data structures based on Obsidian's Canvas API
interface CanvasNodeData {
    id: string;
    type: string;
    position: {
        x: number;
        y: number;
    };
    width: number;
    height: number;
}

interface CanvasTextNodeData extends CanvasNodeData {
    type: "text";
    text: string;
}

interface CanvasFileNodeData extends CanvasNodeData {
    type: "file";
    file: string;
}

interface CanvasLinkNodeData extends CanvasNodeData {
    type: "link";
    url: string;
}

interface CanvasEdge {
    id: string;
    fromNode: string;
    fromSide: string;
    toNode: string;
    toSide: string;
}

interface CanvasData {
    nodes: CanvasNodeData[];
    edges: CanvasEdge[];
}

export default class Main extends Plugin {
    settings: PluginSettings;
    selectedCanvas: TFile | null = null;

    async onload() {
        await this.loadSettings();

        // Add settings tab
        this.addSettingTab(new SettingsTab(this.app, this));

        // Add command to select a canvas file
        this.addCommand({
            id: "select-canvas-file",
            name: "Select a canvas file",
            callback: () => {
                this.selectCanvasFile();
            },
        });

        // Add command to send selection to canvas as plain text
        this.addCommand({
            id: "send-selection-to-canvas-as-plain-text",
            name: "Send selection to canvas as plain text",
            editorCallback: (editor: Editor) => {
                this.sendSelectionToCanvas(editor, "plain");
            },
        });

        // Add command to send selection to canvas as block link
        this.addCommand({
            id: "send-selection-to-canvas-as-block-link",
            name: "Send selection to canvas as block link",
            editorCallback: (editor: Editor) => {
                this.sendSelectionToCanvas(editor, "link");
            },
        });

        // Add command to send selection to canvas as block embed
        this.addCommand({
            id: "send-selection-to-canvas-as-block-embed",
            name: "Send selection to canvas as block embed",
            editorCallback: (editor: Editor) => {
                this.sendSelectionToCanvas(editor, "embed");
            },
        });

        // Add command to send the current note to canvas
        this.addCommand({
            id: "send-current-note-to-canvas",
            name: "Send current note to canvas",
            callback: () => {
                this.sendCurrentNoteToCanvas();
            },
        });

        // Add context menu for editor
        this.registerEvent(
            // Use a proper type for the event handler
            this.app.workspace.on("editor-menu", (menu, editor, view) => {
                if (editor) {
                    // Always show the menu option - we'll handle empty selection in the handler
                    menu.addItem((item: MenuItem) => {
                        item.setTitle("Send to canvas")
                            .setIcon("send-to-graph")
                            .onClick((evt: MouseEvent | KeyboardEvent) => {
                                this.showSendMenu(editor, evt);
                            });
                    });
                }
            }),
        );
    }

    onunload() {
        // Cleanup when the plugin is disabled
    }

    async loadSettings() {
        this.settings = Object.assign(
            {},
            DEFAULT_SETTINGS,
            await this.loadData(),
        );

        // If remember last canvas is enabled and there's a saved path, try to load it
        if (this.settings.rememberLastCanvas && this.settings.lastCanvasPath) {
            const file = this.app.vault.getAbstractFileByPath(
                this.settings.lastCanvasPath,
            );
            if (file instanceof TFile && file.extension === "canvas") {
                this.selectedCanvas = file;
            }
        }
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    selectCanvasFile() {
        const canvasFiles = this.getCanvasFiles();
        if (!canvasFiles.length) {
            new Notice("No canvas files found in vault");
            return;
        }

        const modal = new CanvasFileSuggestModal(
            this.app,
            canvasFiles,
            (file: TFile) => {
                this.selectedCanvas = file;
                this.settings.lastCanvasPath = file.path;
                this.saveSettings();
                new Notice(`Selected canvas: ${file.name}`);
            },
        );
        modal.open();
    }

    async sendSelectionToCanvas(editor: Editor, format: SendFormat) {
        if (!this.selectedCanvas) {
            new Notice("Please select a canvas file first");
            this.selectCanvasFile();
            return;
        }

        let selection = editor.getSelection();

        // If no text is selected, get the current line
        if (!selection || selection.trim() === "") {
            const cursor = editor.getCursor();
            const line = editor.getLine(cursor.line);

            if (line && line.trim() !== "") {
                // Select the current line
                selection = line;

                // Update the editor's selection to match
                const lineLength = line.length;
                editor.setSelection(
                    { line: cursor.line, ch: 0 },
                    { line: cursor.line, ch: lineLength },
                );

                console.log("Auto-selected current line for sending to canvas");
            } else {
                new Notice("No text selected and current line is empty");
                return;
            }
        }

        const currentView =
            this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!currentView) {
            new Notice("No active markdown file");
            return;
        }

        const currentFile = currentView.file;
        if (!currentFile) {
            new Notice("Could not determine the current file");
            return;
        }

        const currentContent = selection;
        let contentToSend = currentContent;

        try {
            // Process content based on settings
            if (this.settings.includeTagsInSend) {
                // Extract tags if any in the selection
                const tags = BlockReferenceUtils.extractTags(currentContent);
                if (tags && tags.length > 0) {
                    contentToSend += `\n\nTags: ${tags.join(", ")}`;
                }
            }

            if (
                this.settings.includeTaskPropertiesInSend &&
                currentContent.includes("- [ ]")
            ) {
                // Process task properties
                contentToSend =
                    BlockReferenceUtils.processTaskProperties(contentToSend);
            }

            // Create block reference for link and embed formats
            let blockId = "";
            if (format === "link" || format === "embed") {
                blockId = await this.createBlockReference(
                    currentFile,
                    selection,
                );
                if (!blockId) {
                    new Notice("Failed to create block reference");
                    return;
                }
            }

            await this.addToCanvas(format, contentToSend, currentFile, blockId);
            new Notice(`Content sent to canvas: ${this.selectedCanvas.name}`);
        } catch (error) {
            console.error("Error sending to canvas:", error);
            new Notice(
                `Failed to send content to canvas: ${
                    error.message || "Unknown error"
                }`,
            );
        }
    }

    async sendCurrentNoteToCanvas() {
        if (!this.selectedCanvas) {
            new Notice("Please select a canvas file first");
            this.selectCanvasFile();
            return;
        }

        const currentView =
            this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!currentView) {
            new Notice("No active markdown file");
            return;
        }

        const currentFile = currentView.file;
        if (!currentFile) {
            new Notice("Could not determine the current file");
            return;
        }

        try {
            await this.addNoteToCanvas(currentFile);
            new Notice(`Note sent to canvas: ${this.selectedCanvas.name}`);
        } catch (error) {
            console.error("Error sending note to canvas:", error);
            new Notice(
                `Failed to send note to canvas: ${error.message || "Unknown error"}`,
            );
        }
    }

    showSendMenu(editor: Editor, event: MouseEvent | KeyboardEvent) {
        const menu = new Menu();

        menu.addItem((item) => {
            item.setTitle("Send as plain text").onClick(() => {
                this.sendSelectionToCanvas(editor, "plain");
            });
        });

        menu.addItem((item) => {
            item.setTitle("Send as block link").onClick(() => {
                this.sendSelectionToCanvas(editor, "link");
            });
        });

        menu.addItem((item) => {
            item.setTitle("Send as block embed").onClick(() => {
                this.sendSelectionToCanvas(editor, "embed");
            });
        });

        // Try using the provided mouse event first
        if (event) {
            // Check if it's a MouseEvent by looking for mouse-specific properties
            if ("clientX" in event && "clientY" in event) {
                menu.showAtMouseEvent(event as MouseEvent);
            } else {
                // Fallback for keyboard events or other event types
                menu.showAtPosition({ x: 100, y: 100 });
            }
        } else {
            // Fallback to showing at a calculated position
            menu.showAtPosition({ x: 100, y: 100 });
        }
    }

    getCanvasFiles(): TFile[] {
        return this.app.vault
            .getFiles()
            .filter((file) => file.extension === "canvas");
    }

    async createBlockReference(
        file: TFile,
        selectedText: string,
    ): Promise<string> {
        return BlockReferenceUtils.createBlockReference(
            this.app.vault,
            file,
            selectedText,
        );
    }

    generateBlockId(): string {
        // Generate a random node ID for canvas
        return (
            Date.now().toString() + Math.random().toString(36).substring(2, 9)
        );
    }

    async addToCanvas(
        format: SendFormat,
        content: string,
        sourceFile: TFile,
        blockId: string = "",
    ) {
        if (!this.selectedCanvas) return;

        // Read the canvas file
        let canvasContent: string;
        try {
            canvasContent = await this.app.vault.read(this.selectedCanvas);

            // Check if the canvas content is empty or too short to be valid JSON
            if (!canvasContent || canvasContent.trim().length < 2) {
                // Initialize with empty canvas structure
                canvasContent = JSON.stringify({ nodes: [], edges: [] });

                // Save the initialized structure to the file
                await this.app.vault.modify(this.selectedCanvas, canvasContent);
                console.log(
                    "Initialized empty canvas file with basic structure",
                );
            }
        } catch (error) {
            console.error("Error reading canvas file:", error);
            new Notice(
                `Failed to read canvas file: ${error.message || "Unknown error"}`,
            );
            return;
        }

        let canvasData: CanvasData;

        try {
            canvasData = JSON.parse(canvasContent);

            // Check and initialize data structure if needed
            if (!canvasData.nodes) canvasData.nodes = [];
            if (!canvasData.edges) canvasData.edges = [];
        } catch (error) {
            console.error("Error parsing canvas data:", error);
            new Notice(
                "Error parsing canvas file. It may not be in the expected format.",
            );

            // Try to recover by creating a new canvas structure
            canvasData = { nodes: [], edges: [] };
            console.log(
                "Created new canvas data structure after parsing error",
            );
        }

        // Determine the position for the new node
        const newNodePosition = this.calculateNewNodePosition(canvasData.nodes);

        // Create the new node based on the format
        let newNode: CanvasTextNodeData = {
            id: this.generateNodeId(),
            type: "text",
            position: {
                x: newNodePosition.x,
                y: newNodePosition.y,
            },
            width: 400,
            height: 200,
            text: "",
        };

        if (format === "plain") {
            newNode.text = content;
        } else if (format === "link") {
            // Use a simpler format for block links without the display text part
            newNode.text = `[[${sourceFile.path}#^${blockId}]]`;
        } else if (format === "embed") {
            newNode.text = `![[${sourceFile.path}#^${blockId}]]`;
        }

        // Add the new node to the canvas
        canvasData.nodes.push(newNode);

        // Save the modified canvas
        try {
            await this.app.vault.modify(
                this.selectedCanvas,
                JSON.stringify(canvasData, null, 2),
            );
        } catch (error) {
            console.error("Error saving canvas:", error);
            new Notice(
                `Failed to save canvas: ${error.message || "Unknown error"}`,
            );
        }
    }

    async addNoteToCanvas(noteFile: TFile) {
        if (!this.selectedCanvas) return;

        // Read the canvas file
        let canvasContent: string;
        try {
            canvasContent = await this.app.vault.read(this.selectedCanvas);

            // Check if the canvas content is empty or too short to be valid JSON
            if (!canvasContent || canvasContent.trim().length < 2) {
                // Initialize with empty canvas structure
                canvasContent = JSON.stringify({ nodes: [], edges: [] });

                // Save the initialized structure to the file
                await this.app.vault.modify(this.selectedCanvas, canvasContent);
                console.log(
                    "Initialized empty canvas file with basic structure",
                );
            }
        } catch (error) {
            console.error("Error reading canvas file:", error);
            new Notice(
                `Failed to read canvas file: ${error.message || "Unknown error"}`,
            );
            return;
        }

        let canvasData: CanvasData;

        try {
            canvasData = JSON.parse(canvasContent);

            // Check and initialize data structure if needed
            if (!canvasData.nodes) canvasData.nodes = [];
            if (!canvasData.edges) canvasData.edges = [];
        } catch (error) {
            console.error("Error parsing canvas data:", error);
            new Notice(
                "Error parsing canvas file. It may not be in the expected format.",
            );

            // Try to recover by creating a new canvas structure
            canvasData = { nodes: [], edges: [] };
            console.log(
                "Created new canvas data structure after parsing error",
            );
        }

        // Determine the position for the new node
        const newNodePosition = this.calculateNewNodePosition(canvasData.nodes);

        // Create a new file node
        const newNode: CanvasFileNodeData = {
            id: this.generateNodeId(),
            type: "file",
            file: noteFile.path,
            position: {
                x: newNodePosition.x,
                y: newNodePosition.y,
            },
            width: 400,
            height: 400,
        };

        // Add the new node to the canvas
        canvasData.nodes.push(newNode);

        // Save the modified canvas
        try {
            await this.app.vault.modify(
                this.selectedCanvas,
                JSON.stringify(canvasData, null, 2),
            );
        } catch (error) {
            console.error("Error saving canvas:", error);
            new Notice(
                `Failed to save canvas: ${error.message || "Unknown error"}`,
            );
        }
    }

    calculateNewNodePosition(existingNodes: CanvasNodeData[]) {
        // Default position if no nodes exist
        if (!existingNodes.length) {
            return { x: 0, y: 0 };
        }

        // Find the rightmost node
        let maxX = Math.max(
            ...existingNodes.map((node) => {
                const nodeX = node.position.x;
                const nodeWidth = node.width || 400;
                return nodeX + nodeWidth;
            }),
        );

        // Position the new node to the right with some padding
        return { x: maxX + 50, y: 0 };
    }

    generateNodeId(): string {
        // Generate a random node ID for canvas
        return (
            Date.now().toString() + Math.random().toString(36).substring(2, 9)
        );
    }
}

// Modal for selecting canvas files
class CanvasFileSuggestModal extends FuzzySuggestModal<TFile> {
    files: TFile[];
    onSelect: (file: TFile) => void;

    constructor(app: any, files: TFile[], onSelect: (file: TFile) => void) {
        super(app);
        this.files = files;
        this.onSelect = onSelect;
    }

    getItems(): TFile[] {
        return this.files;
    }

    getItemText(file: TFile): string {
        return file.name;
    }

    onChooseItem(file: TFile, evt: MouseEvent | KeyboardEvent): void {
        this.onSelect(file);
    }
}
