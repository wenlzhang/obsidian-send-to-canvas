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
    moment,
} from "obsidian";
import { CanvasNodeData, CanvasData, CanvasTextData, CanvasFileData, CanvasLinkData, CanvasEdgeData, AllCanvasNodeData } from "obsidian/canvas";
import { SettingsTab } from "./settingsTab";
import { SendToCanvasSettings, DEFAULT_SETTINGS, SendFormat } from "./settings";
import { BlockReferenceUtils } from "./utils";
import "../styles.css";

export default class Main extends Plugin {
    settings: SendToCanvasSettings;
    selectedCanvas: TFile | null = null;
    statusBarItem: HTMLElement;

    async onload() {
        await this.loadSettings();

        // Add status bar item for selected canvas
        this.statusBarItem = this.addStatusBarItem();
        this.statusBarItem.addClass("send-to-canvas-status");
        this.updateStatusBar(); // Initialize the status bar immediately

        // Wait for Obsidian to fully load all files before trying to find the canvas file
        // Use a timeout with the user-configurable delay
        setTimeout(() => {
            this.loadCanvasFile();
            this.updateStatusBar();

            // Check if we have canvas files in the vault
            const canvasFiles = this.getCanvasFiles();
            if (canvasFiles.length === 0) {
                // No canvas files found during startup
            } else {
                // Found canvas files during startup
            }
        }, this.settings.startupLoadDelay * 1000); // Convert seconds to milliseconds

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
            id: "send-block-text",
            name: "Send block text",
            editorCallback: (editor: Editor) => {
                this.sendSelectionToCanvas(editor, "plain");
            },
        });

        // Add command to send selection to canvas as block link
        this.addCommand({
            id: "send-block-link",
            name: "Send block link",
            editorCallback: (editor: Editor) => {
                this.sendSelectionToCanvas(editor, "link");
            },
        });

        // Add command to send selection to canvas as block embed
        this.addCommand({
            id: "send-block-embed",
            name: "Send block embed",
            editorCallback: (editor: Editor) => {
                this.sendSelectionToCanvas(editor, "embed");
            },
        });

        // Add command to send note link to canvas
        this.addCommand({
            id: "send-note-link",
            name: "Send note link",
            callback: () => {
                this.sendNoteAsLinkToCanvas();
            },
        });

        // Add command to send the current note to canvas
        this.addCommand({
            id: "send-note-embed",
            name: "Send note embed",
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
                                // Store the current mouse position when the menu item is clicked
                                const mousePos = { x: 0, y: 0 };
                                if (evt instanceof MouseEvent) {
                                    mousePos.x = evt.clientX;
                                    mousePos.y = evt.clientY;
                                }
                                this.showSendMenu(editor, mousePos);
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
        // Don't try to load the canvas file here - we'll do it after the workspace is ready
    }

    async loadCanvasFile() {
        // If there's a saved path, try to load it (regardless of rememberLastCanvas setting)
        if (
            this.settings.lastCanvasPath &&
            this.settings.lastCanvasPath.length > 0
        ) {
            try {
                // Try to find the canvas file
                const file = this.findCanvasFile(this.settings.lastCanvasPath);

                if (file) {
                    this.selectedCanvas = file;

                    // Update the path to ensure it's the full path
                    if (this.settings.lastCanvasPath !== file.path) {
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
                    // If the file no longer exists, clear the saved path
                    this.settings.lastCanvasPath = "";
                    await this.saveSettings();
                }
            } catch (error) {
                // Error loading canvas file
                // Don't clear the path here, as it might be a temporary error
            }
        }
    }

    async saveSettings() {
        try {
            // Always save the current canvas path if one is selected
            if (this.selectedCanvas) {
                // Ensure we're saving the full path
                this.settings.lastCanvasPath = this.selectedCanvas.path;
            }

            // Save settings to data.json
            await this.saveData(this.settings);
        } catch (error) {
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
            },
        );
        modal.open();
    }

    async sendSelectionToCanvas(editor: Editor, format: SendFormat) {
        // Check if a canvas file is selected
        if (!this.selectedCanvas) {
            new Notice("Please select a canvas file first");
            this.selectCanvasFile();
            return;
        }

        // Get the current file
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

        // Save original cursor position
        const originalCursor = editor.getCursor();

        // Get the selection or current line
        let textToSend = editor.getSelection();

        // If no text is selected, use the current line
        if (!textToSend || textToSend.trim() === "") {
            const line = editor.getLine(originalCursor.line);

            if (line && line.trim() !== "") {
                // Use the current line but don't visually select it
                textToSend = line;
            } else {
                new Notice("Current line is empty");
                return;
            }
        }

        // We don't want to modify the content for the canvas directly
        // Only when creating a block ID for source file
        let contentToSend = textToSend;

        // Generate a block ID for link and embed formats
        let blockId = "";

        try {
            if (format === "link" || format === "embed") {
                // Add a block ID to the selection
                blockId = await this.addBlockIdToSelection(
                    editor,
                    currentFile,
                    textToSend, // Use the original text to find the right position
                );

                // If a block ID was successfully added, get the updated line content from the file
                if (blockId) {
                    // Get the updated content from the file
                    const fileContent = await this.app.vault.read(currentFile);
                    const lines = fileContent.split("\n");

                    // Find the line containing the block ID
                    for (let i = 0; i < lines.length; i++) {
                        if (lines[i].includes(`^${blockId}`)) {
                            // Extract the content without the block ID
                            contentToSend = lines[i].replace(
                                ` ^${blockId}`,
                                "",
                            );
                            break;
                        }
                    }
                }
            }

            // Add the content to the canvas
            await this.addToCanvas(format, contentToSend, currentFile, blockId);

            // Restore the original cursor position
            editor.setCursor(originalCursor);

            new Notice(`Selection sent to canvas: ${this.selectedCanvas.name}`);
        } catch (error) {
            console.error("Error sending selection to canvas:", error);
            new Notice("Error sending selection to canvas");

            // Restore the cursor position even if there was an error
            editor.setCursor(originalCursor);
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
            new Notice(
                `Failed to send note link to canvas: ${
                    error.message || "Unknown error"
                }`,
            );
        }
    }

    showSendMenu(editor: Editor, mousePos: { x: number; y: number }) {
        const menu = new Menu();

        // Block-related commands (for selected text)
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

        // Add a separator
        menu.addSeparator();

        // Note-related commands
        menu.addItem((item) => {
            item.setTitle("Send note link").onClick(() => {
                this.sendNoteAsLinkToCanvas();
            });
        });

        menu.addItem((item) => {
            item.setTitle("Send note embed").onClick(() => {
                this.sendCurrentNoteToCanvas();
            });
        });

        // Position the menu at the stored mouse position
        if (mousePos.x !== 0 && mousePos.y !== 0) {
            // Use the stored mouse position
            menu.showAtPosition(mousePos);
        } else {
            // Fallback: try to position near the editor
            const view = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (view && view.containerEl) {
                const rect = view.containerEl.getBoundingClientRect();
                // Position it more toward the center of the editor
                menu.showAtPosition({
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 3,
                });
            } else {
                // Last resort fallback
                menu.showAtPosition({ x: 100, y: 100 });
            }
        }
    }

    getCanvasFiles(): TFile[] {
        const files = this.app.vault.getFiles();

        // Try the standard way first - files with .canvas extension
        let canvasFiles = files.filter((file) => file.extension === "canvas");

        // If no canvas files were found, try alternative detection methods
        if (canvasFiles.length === 0) {
            // Try alternative detection methods:
            // 1. Check for files with "canvas" in the name
            const nameBasedCanvasFiles = files.filter((f) =>
                f.name.toLowerCase().includes("canvas"),
            );

            if (nameBasedCanvasFiles.length > 0) {
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
        // Get all canvas files in the vault
        const allCanvasFiles = this.getCanvasFiles();

        // First try to get by exact path
        const fileByPath = this.app.vault.getAbstractFileByPath(nameOrPath);
        if (fileByPath instanceof TFile && fileByPath.extension === "canvas") {
            return fileByPath;
        }

        // If that fails, try to find by name
        const fileName = nameOrPath.split("/").pop() || nameOrPath;

        // Try exact name match
        let matchingFile = allCanvasFiles.find((f) => f.name === fileName);
        if (matchingFile) {
            return matchingFile;
        }

        // Try case-insensitive name match
        matchingFile = allCanvasFiles.find(
            (f) => f.name.toLowerCase() === fileName.toLowerCase(),
        );
        if (matchingFile) {
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
            return matchingFile;
        }

        // Try partial name match as last resort
        matchingFile = allCanvasFiles.find(
            (f) =>
                f.name.includes(baseNameWithoutExt) ||
                f.name.toLowerCase().includes(baseNameWithoutExt.toLowerCase()),
        );
        if (matchingFile) {
            return matchingFile;
        }

        return null;
    }

    /**
     * Calculates a position for a new node based on existing nodes
     * @param nodes Existing nodes in the canvas
     * @returns Position for the new node
     */
    calculateNewNodePosition(nodes: CanvasNodeData[]): {
        x: number;
        y: number;
    } {
        // Default position if there are no nodes
        if (!nodes || nodes.length === 0) {
            return { x: 0, y: 0 };
        }

        // Filter out nodes without a valid position property
        const validNodes = nodes.filter(
            (node) =>
                node.position &&
                typeof node.position.x === "number" &&
                typeof node.position.y === "number",
        );

        // If no valid nodes, return default position
        if (validNodes.length === 0) {
            return { x: 0, y: 0 };
        }

        // Find the rightmost node
        let rightmostNode = validNodes[0];
        for (const node of validNodes) {
            if (node.position.x > rightmostNode.position.x) {
                rightmostNode = node;
            }
        }

        // Position the new node to the right of the rightmost node
        // with a small gap
        return {
            x: rightmostNode.position.x + 500,
            y: rightmostNode.position.y,
        };
    }

    /**
     * Generates a unique ID for a canvas node
     * @returns A unique ID string
     */
    generateNodeId(): string {
        return "node-" + Math.random().toString(36).substring(2, 9);
    }

    async addBlockIdToSelection(
        editor: Editor,
        file: TFile,
        content: string,
    ): Promise<string> {
        try {
            // Save the original cursor position
            const originalCursor = editor.getCursor();

            // Read the file content
            const fileContent = await this.app.vault.read(file);
            const lineContent = editor.getLine(originalCursor.line);

            // Find the position of the content in the file
            let position = BlockReferenceUtils.findTextPosition(
                fileContent,
                content,
            );

            // If position not found but we're working with the current line
            if (!position && content === lineContent) {
                position = {
                    line: originalCursor.line,
                    offset: 0,
                };
            }

            if (!position) {
                // Try one more approach - look for content after basic normalization
                const lines = fileContent.split("\n");
                const trimmedContent = content.trim();

                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].trim() === trimmedContent) {
                        position = {
                            line: i,
                            offset: lines[i].indexOf(trimmedContent.charAt(0)),
                        };
                        break;
                    }
                }
            }

            if (!position) {
                // Generate a block ID anyway to ensure embedding works
                const blockId = BlockReferenceUtils.generateBlockId(
                    this.settings,
                );

                // Try to add it to the current line but preserve cursor position
                const line = originalCursor.line;
                const currentContent = editor.getLine(line);

                if (currentContent && currentContent.trim() !== "") {
                    // Check if we need to append the task text configuration
                    const modifiedContent = this.appendTextToOpenTask(
                        currentContent,
                        true,
                    );

                    // Update the file directly instead of using editor.setLine to preserve cursor
                    const lines = fileContent.split("\n");
                    lines[line] = modifiedContent + ` ^${blockId}`;
                    await this.app.vault.modify(file, lines.join("\n"));

                    // Restore cursor position
                    editor.setCursor(originalCursor);

                    return blockId;
                }

                return "";
            }

            // Check if the line already has a block ID
            const lines = fileContent.split("\n");
            const line = lines[position.line];

            // If the line already has a block ID, return it
            const existingIdMatch = line.match(/\^([a-zA-Z0-9-]+)$/);
            if (existingIdMatch) {
                return existingIdMatch[1];
            }

            // Generate a new block ID
            const blockId = BlockReferenceUtils.generateBlockId(this.settings);

            // Check if we need to append the task text configuration
            const modifiedLine = this.appendTextToOpenTask(line, true);
            console.log("Original line:", line);
            console.log("Modified line after task text append:", modifiedLine);

            // Add the block ID to the line
            lines[position.line] = modifiedLine + ` ^${blockId}`;
            console.log("Final line with block ID:", lines[position.line]);

            // Update the file
            await this.app.vault.modify(file, lines.join("\n"));

            // Restore cursor position if needed
            if (position.line === originalCursor.line) {
                editor.setCursor(originalCursor);
            }

            return blockId;
        } catch (error) {
            console.error("Error adding block ID to selection:", error);
            return "";
        }
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
        blockId = "",
    ): Promise<void> {
        if (!this.selectedCanvas) {
            new Notice("No canvas selected");
            return;
        }

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
            }
        } catch (error) {
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
            new Notice(
                "Error parsing canvas file. It may not be in the expected format.",
            );

            // Try to recover by creating a new canvas structure
            canvasData = { nodes: [], edges: [] };
        }

        // Determine the position for the new node
        const newNodePosition = this.calculateNewNodePosition(canvasData.nodes);

        // Generate the content to add based on format
        let textContent = content;

        // Determine node dimensions based on format
        let nodeWidth: number;
        let nodeHeight: number;

        if (format === "link" || format === "embed") {
            // Create a link or embed with the block ID
            let linkText = "";

            if (format === "link") {
                // Use a simpler format for block links without the display text part
                linkText = `[[${sourceFile.basename}#^${blockId}]]`;
            } else if (format === "embed") {
                // Use the file basename instead of the full path
                linkText = `![[${sourceFile.basename}#^${blockId}]]`;

                // For block embeds of open tasks, check if we need to modify the source file
                // This ensures the embedded content will include the appended text
                if (
                    content.trim().startsWith("- [ ]") &&
                    this.settings.appendTextToOpenTasks
                ) {
                    try {
                        // Read the file content to check for the block ID
                        const fileContent =
                            await this.app.vault.read(sourceFile);
                        const lines = fileContent.split("\n");

                        // Find the line with this block ID
                        for (let i = 0; i < lines.length; i++) {
                            if (lines[i].includes(`^${blockId}`)) {
                                const lineWithoutBlockId = lines[i].replace(
                                    ` ^${blockId}`,
                                    "",
                                );

                                // Check if we need to append the custom text
                                if (
                                    !lineWithoutBlockId.includes(
                                        this.settings.openTaskAppendText,
                                    )
                                ) {
                                    // Modify the line to include the appended text
                                    const modifiedLine =
                                        lineWithoutBlockId.trimEnd() +
                                        " " +
                                        this.settings.openTaskAppendText +
                                        ` ^${blockId}`;

                                    lines[i] = modifiedLine;

                                    // Update the file
                                    await this.app.vault.modify(
                                        sourceFile,
                                        lines.join("\n"),
                                    );
                                }
                                break;
                            }
                        }
                    } catch (error) {
                        console.error(
                            "Error updating source file for block embed:",
                            error,
                        );
                    }
                }
            }

            textContent = linkText;

            // Append timestamp if enabled
            if (this.settings.appendTimestampToLinks) {
                const timestamp = moment().format(
                    this.settings.appendTimestampFormat,
                );
                textContent += ` ${timestamp}`;
            }

            // Use appropriate node dimensions based on format
            if (format === "link") {
                // Use link node dimensions for links
                nodeWidth = this.settings.linkNodeWidth;
                nodeHeight = this.settings.linkNodeHeight;
            } else {
                // Use content node dimensions for embeds
                nodeWidth = this.settings.contentNodeWidth;
                nodeHeight = this.settings.contentNodeHeight;
            }
        } else {
            // Plain text - use content as is without appending text to open tasks
            // Don't modify the content for the canvas, only for source files

            // Use content node dimensions
            nodeWidth = this.settings.contentNodeWidth;
            nodeHeight = this.settings.contentNodeHeight;
        }

        // Create the new node
        const newNode: CanvasTextData = {
            id: this.generateNodeId(),
            type: "text",
            x: newNodePosition.x,
            y: newNodePosition.y,
            width: nodeWidth,
            height: nodeHeight,
            text: textContent,
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
            }
        } catch (error) {
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
            new Notice(
                "Error parsing canvas file. It may not be in the expected format.",
            );

            // Try to recover by creating a new canvas structure
            canvasData = { nodes: [], edges: [] };
        }

        // Determine the position for the new node
        const newNodePosition = this.calculateNewNodePosition(canvasData.nodes);

        // Create a new file node
        const newNode: CanvasFileData = {
            id: this.generateNodeId(),
            type: "file",
            file: noteFile.path,
            x: newNodePosition.x,
            y: newNodePosition.y,
            width: this.settings.fileNodeWidth,
            height: this.settings.fileNodeHeight,
        };

        // Add the new node to the canvas
        canvasData.nodes.push(newNode);

        // Save the modified canvas
        try {
            await this.app.vault.modify(
                this.selectedCanvas,
                JSON.stringify(canvasData, null, 2),
            );

            new Notice(`Note sent to canvas: ${this.selectedCanvas.name}`);
        } catch (error) {
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
            }
        } catch (error) {
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
            new Notice(
                "Error parsing canvas file. It may not be in the expected format.",
            );

            // Try to recover by creating a new canvas structure
            canvasData = { nodes: [], edges: [] };
        }

        // Determine the position for the new node
        const newNodePosition = this.calculateNewNodePosition(canvasData.nodes);

        // Create the note link text
        let linkText = `[[${noteFile.basename}]]`;

        // Append timestamp if enabled
        if (this.settings.appendTimestampToLinks) {
            const timestamp = moment().format(
                this.settings.appendTimestampFormat,
            );
            linkText += ` ${timestamp}`;
        }

        // Create a new text node with the note link in Obsidian markdown format
        const newNode: CanvasTextData = {
            id: this.generateNodeId(),
            type: "text",
            text: linkText,
            x: newNodePosition.x,
            y: newNodePosition.y,
            width: this.settings.linkNodeWidth,
            height: this.settings.linkNodeHeight,
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
            new Notice(
                `Failed to save canvas: ${error.message || "Unknown error"}`,
            );
        }
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

        // If we have a saved path, try to find it
        if (this.settings.lastCanvasPath) {
            const found = this.findCanvasFile(this.settings.lastCanvasPath);
        }

        // Show a notice with the number of canvas files
        new Notice(
            `Found ${allCanvasFiles.length} canvas files in vault. Check console for details.`,
        );
    }

    // Helper method to append text to open tasks if settings enabled
    // When modifySourceOnly is true, it only returns modified text for updating the source file
    // When modifySourceOnly is false, it modifies text for both source file and canvas content
    appendTextToOpenTask(text: string, modifySourceOnly = false): string {
        if (
            !text ||
            !text.trim().startsWith("- [ ]") ||
            !this.settings.appendTextToOpenTasks
        ) {
            return text;
        }

        // If we're only supposed to modify the source file and this is for canvas content, return unmodified
        if (modifySourceOnly) {
            // Only append if the text doesn't already contain the append text
            if (!text.includes(this.settings.openTaskAppendText)) {
                return text.trimEnd() + " " + this.settings.openTaskAppendText;
            }
        }

        return text;
    }

    createTextNode(text: string): CanvasTextData {
        return {
            id: this.generateNodeId(),
            type: "text",
            text,
            x: 0,
            y: 0,
            width: 400,
            height: 200,
        };
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
