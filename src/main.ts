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

interface CanvasEdgeData {
    id: string;
    fromNode: string;
    fromSide: string;
    toNode: string;
    toSide: string;
}

interface CanvasData {
    nodes: CanvasNodeData[];
    edges: CanvasEdgeData[];
}

export default class Main extends Plugin {
    settings: PluginSettings;
    selectedCanvas: TFile | null = null;
    statusBarItem: HTMLElement;

    async onload() {
        await this.loadSettings();

        // Add status bar item for selected canvas
        this.statusBarItem = this.addStatusBarItem();

        // Wait for Obsidian to fully load all files before trying to find the canvas file
        // Use a timeout to ensure all files are loaded
        console.log("Setting up delayed canvas file loading");
        setTimeout(() => {
            console.log("Now loading canvas files after delay");
            this.loadCanvasFile();
            this.updateStatusBar();

            // Check if we have canvas files in the vault
            const canvasFiles = this.getCanvasFiles();
            if (canvasFiles.length === 0) {
                console.log(
                    "No canvas files found in vault during startup. This might indicate an issue with file detection.",
                );
            } else {
                console.log(
                    `Found ${canvasFiles.length} canvas files during startup.`,
                );
            }
        }, 5000); // 5 second delay to ensure files are loaded

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

        // Debug command - only visible in developer mode
        if (process.env.NODE_ENV !== "production") {
            this.addCommand({
                id: "debug-canvas-finding",
                name: "Debug: Test canvas file finding",
                callback: () => this.debugCanvasFinding(),
            });
        }

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

        // Add command to send note link to canvas
        this.addCommand({
            id: "send-note-link-to-canvas",
            name: "Send note link to canvas",
            callback: () => {
                this.sendNoteAsLinkToCanvas();
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
        // Load settings from data.json
        this.settings = Object.assign(
            {},
            DEFAULT_SETTINGS,
            await this.loadData(),
        );

        console.log(
            "Settings loaded from data.json:",
            JSON.stringify(this.settings),
        );
        console.log("Last canvas path:", this.settings.lastCanvasPath);

        // Don't try to load the canvas file here - we'll do it after the workspace is ready
    }

    async loadCanvasFile() {
        // If there's a saved path, try to load it (regardless of rememberLastCanvas setting)
        if (
            this.settings.lastCanvasPath &&
            this.settings.lastCanvasPath.length > 0
        ) {
            console.log(
                "Attempting to load canvas file from path or name:",
                this.settings.lastCanvasPath,
            );

            try {
                // Try to find the canvas file
                const file = this.findCanvasFile(this.settings.lastCanvasPath);

                if (file) {
                    console.log("Successfully loaded canvas file:", file.path);
                    this.selectedCanvas = file;

                    // Update the path to ensure it's the full path
                    if (this.settings.lastCanvasPath !== file.path) {
                        console.log(
                            "Updating saved path from",
                            this.settings.lastCanvasPath,
                            "to",
                            file.path,
                        );
                        this.settings.lastCanvasPath = file.path;
                        await this.saveSettings();
                    }

                    // Only show notification and update UI if rememberLastCanvas is enabled
                    if (this.settings.rememberLastCanvas) {
                        // Update the status bar with the loaded canvas
                        setTimeout(() => {
                            this.updateStatusBar();
                            // Show a subtle notification that a canvas was automatically selected
                            new Notice(`Canvas loaded: ${file.basename}`, 2000);
                        }, 500);
                    }
                } else {
                    console.log(
                        "No canvas file found with path or name:",
                        this.settings.lastCanvasPath,
                    );
                    // If the file no longer exists, clear the saved path
                    this.settings.lastCanvasPath = "";
                    await this.saveSettings();
                }
            } catch (error) {
                console.error("Error loading canvas file:", error);
                // Don't clear the path here, as it might be a temporary error
            }
        } else {
            console.log("No saved canvas path found in settings");
        }
    }

    async saveSettings() {
        try {
            // Always save the current canvas path if one is selected
            if (this.selectedCanvas) {
                // Ensure we're saving the full path
                this.settings.lastCanvasPath = this.selectedCanvas.path;
                console.log(
                    "Saving canvas path to settings:",
                    this.settings.lastCanvasPath,
                );
            }

            // Save settings to data.json
            await this.saveData(this.settings);
            console.log(
                "Settings saved to data.json:",
                JSON.stringify(this.settings),
            );
        } catch (error) {
            console.error("Error saving settings:", error);
            new Notice("Error saving settings. Please try again.");
        }
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
            async (file: TFile) => {
                this.selectedCanvas = file;

                // Save the selected canvas path to settings - ensure it's the full path
                this.settings.lastCanvasPath = file.path;
                console.log("Selected canvas file with full path:", file.path);

                await this.saveSettings();

                // Provide more context in the notification
                const persistenceInfo = this.settings.rememberLastCanvas
                    ? "This selection will be remembered across sessions."
                    : "This selection will be valid until you close Obsidian.";

                new Notice(
                    `Selected canvas: ${file.basename}\n${persistenceInfo}`,
                );

                // Update the status bar
                this.updateStatusBar();

                // Log for debugging
                console.log(`Canvas selected and saved: ${file.path}`);
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

        // If no text is selected, get the current line without visually selecting it
        if (!selection || selection.trim() === "") {
            const cursor = editor.getCursor();
            const line = editor.getLine(cursor.line);

            if (line && line.trim() !== "") {
                // Use the current line but don't visually select it
                selection = line;
                console.log(
                    "Using current line for sending to canvas without changing selection",
                );
            } else {
                new Notice("Current line is empty");
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

    async sendNoteAsLinkToCanvas() {
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
            await this.addNoteAsLinkToCanvas(currentFile);
            new Notice(`Note link sent to canvas: ${this.selectedCanvas.name}`);
        } catch (error) {
            console.error("Error sending note link to canvas:", error);
            new Notice(
                `Failed to send note link to canvas: ${
                    error.message || "Unknown error"
                }`,
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
        const files = this.app.vault.getFiles();

        // Try the standard way first - files with .canvas extension
        let canvasFiles = files.filter((file) => file.extension === "canvas");
        console.log(
            "Found canvas files (by extension):",
            canvasFiles.length,
            "files",
        );

        // If no canvas files were found, try alternative detection methods
        if (canvasFiles.length === 0) {
            // Log all file extensions for debugging
            const allExtensions = new Set(files.map((f) => f.extension));
            console.log(
                "All file extensions in vault:",
                Array.from(allExtensions),
            );
            console.log("Total files in vault:", files.length);

            // Try alternative detection methods:
            // 1. Check for files with "canvas" in the name
            const nameBasedCanvasFiles = files.filter((f) =>
                f.name.toLowerCase().includes("canvas"),
            );

            if (nameBasedCanvasFiles.length > 0) {
                console.log(
                    "Found potential canvas files by name:",
                    nameBasedCanvasFiles.map((f) => f.path),
                );
                canvasFiles = nameBasedCanvasFiles;
            }

            // 2. Check if there's a special canvas folder
            const canvasFolders = this.app.vault
                .getAllLoadedFiles()
                .filter(
                    (f) =>
                        f.name.toLowerCase().includes("canvas") &&
                        !(f instanceof TFile),
                );

            if (canvasFolders.length > 0) {
                console.log(
                    "Found potential canvas folders:",
                    canvasFolders.map((f) => f.path),
                );

                // Look for files in these folders
                const filesInCanvasFolders = files.filter((f) =>
                    canvasFolders.some((folder) =>
                        f.path.startsWith(folder.path + "/"),
                    ),
                );

                if (filesInCanvasFolders.length > 0) {
                    console.log(
                        "Found files in canvas folders:",
                        filesInCanvasFolders.map((f) => f.path),
                    );
                    // Add these to our canvas files if we haven't found any yet
                    if (canvasFiles.length === 0) {
                        canvasFiles = filesInCanvasFolders;
                    }
                }
            }

            // 3. Check for any JSON files that might be canvas files
            const jsonFiles = files.filter((f) => f.extension === "json");
            if (jsonFiles.length > 0 && canvasFiles.length === 0) {
                console.log(
                    "Found JSON files that might be canvas files:",
                    jsonFiles.map((f) => f.path),
                );
                // We don't automatically use these, but log them for debugging
            }
        }

        return canvasFiles;
    }

    // Helper method to find a canvas file by name or path
    findCanvasFile(nameOrPath: string): TFile | null {
        // Log all canvas files in the vault for debugging
        const allCanvasFiles = this.getCanvasFiles();
        console.log(
            "All canvas files in vault:",
            allCanvasFiles.map((f) => f.path),
        );

        // First try to get by exact path
        const fileByPath = this.app.vault.getAbstractFileByPath(nameOrPath);
        if (fileByPath instanceof TFile && fileByPath.extension === "canvas") {
            console.log("Found canvas file by exact path:", fileByPath.path);
            return fileByPath;
        }

        // If that fails, try to find by name
        const fileName = nameOrPath.split("/").pop() || nameOrPath;
        console.log("Trying to find canvas by name:", fileName);

        // Try exact name match
        let matchingFile = allCanvasFiles.find((f) => f.name === fileName);

        if (matchingFile) {
            console.log(
                "Found canvas file by exact name match:",
                matchingFile.path,
            );
            return matchingFile;
        }

        // Try case-insensitive name match
        matchingFile = allCanvasFiles.find(
            (f) => f.name.toLowerCase() === fileName.toLowerCase(),
        );

        if (matchingFile) {
            console.log(
                "Found canvas file by case-insensitive name match:",
                matchingFile.path,
            );
            return matchingFile;
        }

        // Try basename match (without extension)
        const baseNameWithoutExt = fileName.replace(/\.canvas$/, "");
        matchingFile = allCanvasFiles.find(
            (f) =>
                f.basename === baseNameWithoutExt ||
                f.basename.toLowerCase() === baseNameWithoutExt.toLowerCase(),
        );

        if (matchingFile) {
            console.log(
                "Found canvas file by basename match:",
                matchingFile.path,
            );
            return matchingFile;
        }

        // Try partial name match as last resort
        matchingFile = allCanvasFiles.find(
            (f) =>
                f.name.includes(baseNameWithoutExt) ||
                f.name.toLowerCase().includes(baseNameWithoutExt.toLowerCase()),
        );

        if (matchingFile) {
            console.log(
                "Found canvas file by partial name match:",
                matchingFile.path,
            );
            return matchingFile;
        }

        console.log("No canvas file found with name:", fileName);
        return null;
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
            // Use the file basename instead of the full path
            newNode.text = `[[${sourceFile.basename}#^${blockId}]]`;
        } else if (format === "embed") {
            // Use the file basename instead of the full path
            newNode.text = `![[${sourceFile.basename}#^${blockId}]]`;
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

    async addNoteAsLinkToCanvas(noteFile: TFile) {
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

        // Create a new text node with the note link in Obsidian markdown format
        const newNode: CanvasTextNodeData = {
            id: this.generateNodeId(),
            type: "text",
            text: `[[${noteFile.basename}]]`,
            position: {
                x: newNodePosition.x,
                y: newNodePosition.y,
            },
            width: 400,
            height: 200,
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

    updateStatusBar() {
        if (!this.statusBarItem) return;

        this.statusBarItem.empty();

        if (this.selectedCanvas) {
            this.statusBarItem.setText(
                `Canvas: ${this.selectedCanvas.basename}`,
            );
            this.statusBarItem.addClass("has-canvas-selected");
            this.statusBarItem.removeClass("no-canvas-selected");
        } else {
            this.statusBarItem.setText("No Canvas Selected");
            this.statusBarItem.addClass("no-canvas-selected");
            this.statusBarItem.removeClass("has-canvas-selected");
        }

        // Make the status bar item clickable to select a new canvas
        this.statusBarItem.style.cursor = "pointer";

        // Remove any existing event listeners to prevent duplicates
        const newItem = this.statusBarItem.cloneNode(true);
        this.statusBarItem.parentNode?.replaceChild(
            newItem,
            this.statusBarItem,
        );
        this.statusBarItem = newItem as HTMLElement;

        this.statusBarItem.addEventListener("click", () => {
            this.selectCanvasFile();
        });
    }

    // Debug method to test canvas file finding
    debugCanvasFinding() {
        // Log all canvas files in the vault
        const allCanvasFiles = this.getCanvasFiles();
        console.log("=== DEBUG: Canvas File Finding ===");
        console.log(
            "All canvas files in vault:",
            allCanvasFiles.map((f) => f.path),
        );

        // If we have a saved path, try to find it
        if (this.settings.lastCanvasPath) {
            console.log(
                "Testing finding with saved path:",
                this.settings.lastCanvasPath,
            );
            const found = this.findCanvasFile(this.settings.lastCanvasPath);
            console.log("Result:", found ? found.path : "Not found");
        }

        // Show a notice with the number of canvas files
        new Notice(
            `Found ${allCanvasFiles.length} canvas files in vault. Check console for details.`,
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
