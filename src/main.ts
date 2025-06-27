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
import {
    CanvasNodeData,
    CanvasData,
    CanvasTextData,
    CanvasFileData,
    CanvasLinkData,
    CanvasEdgeData,
    AllCanvasNodeData,
} from "obsidian/canvas";
import { SettingsTab } from "./settingsTab";
import { SendToCanvasSettings, DEFAULT_SETTINGS, SendFormat } from "./settings";
import { BlockReferenceUtils } from "./utils";

export default class Main extends Plugin {
    settings: SendToCanvasSettings;
    selectedCanvas: TFile | null = null;
    statusBarItem: HTMLElement;
    debugMode = false; // Add a debug mode flag

    async onload() {
        await this.loadSettings();

        // Add status bar item for selected Canvas
        this.statusBarItem = this.addStatusBarItem();
        this.statusBarItem.addClass("send-to-canvas-status");

        // Add the click event listener once during initialization
        this.statusBarItem.addEventListener("click", () => {
            this.selectCanvasFile();
        });

        this.updateStatusBar(); // Initialize the status bar immediately

        // Wait for Obsidian layout to be ready before loading Canvas files
        this.app.workspace.onLayoutReady(() => {
            this.loadCanvasFile();
            this.updateStatusBar();
        });

        // Add settings tab
        this.addSettingTab(new SettingsTab(this.app, this));

        // Add command to select a Canvas file
        this.addCommand({
            id: "select-canvas-file",
            name: "Select a Canvas file",
            checkCallback: (checking: boolean) => {
                // Always available
                if (checking) return true;
                this.selectCanvasFile();
                return true;
            },
        });

        // Add command to send selection to Canvas as plain text
        this.addCommand({
            id: "send-block-text",
            name: "Send block text",
            editorCheckCallback: (checking: boolean, editor: Editor) => {
                // Command should be available only if a Canvas is selected
                if (checking) return this.selectedCanvas !== null;
                this.sendSelectionToCanvas(editor, "plain");
                return true;
            },
        });

        // Add command to send selection to Canvas as block link
        this.addCommand({
            id: "send-block-link",
            name: "Send block link",
            editorCheckCallback: (checking: boolean, editor: Editor) => {
                // Command should be available only if a Canvas is selected
                if (checking) return this.selectedCanvas !== null;
                this.sendSelectionToCanvas(editor, "link");
                return true;
            },
        });

        // Add command to send selection to Canvas as block embed
        this.addCommand({
            id: "send-block-embed",
            name: "Send block embed",
            editorCheckCallback: (checking: boolean, editor: Editor) => {
                // Command should be available only if a Canvas is selected
                if (checking) return this.selectedCanvas !== null;
                this.sendSelectionToCanvas(editor, "embed");
                return true;
            },
        });

        // Add command to send note link to Canvas
        this.addCommand({
            id: "send-note-link",
            name: "Send note link",
            checkCallback: (checking: boolean) => {
                // Command should be available only if a Canvas is selected and we're in a markdown view
                const activeView =
                    this.app.workspace.getActiveViewOfType(MarkdownView);
                if (checking)
                    return this.selectedCanvas !== null && activeView !== null;
                this.sendNoteAsLinkToCanvas();
                return true;
            },
        });

        // Add command to send the current note to Canvas
        this.addCommand({
            id: "send-note-embed",
            name: "Send note embed",
            checkCallback: (checking: boolean) => {
                // Command should be available only if a Canvas is selected and we're in a markdown view
                const activeView =
                    this.app.workspace.getActiveViewOfType(MarkdownView);
                if (checking)
                    return this.selectedCanvas !== null && activeView !== null;
                this.sendCurrentNoteToCanvas();
                return true;
            },
        });

        // Add context menu for editor
        this.registerEvent(
            // Use a proper type for the event handler
            this.app.workspace.on("editor-menu", (menu, editor, view) => {
                if (editor) {
                    // Always show the menu option - we'll handle empty selection in the handler
                    menu.addItem((item: MenuItem) => {
                        item.setTitle("Send to Canvas")
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
        // Don't try to load the Canvas file here - we'll do it after the workspace is ready
    }

    async loadCanvasFile() {
        // If there's a saved path, try to load it (regardless of rememberLastCanvas setting)
        if (
            this.settings.lastCanvasPath &&
            this.settings.lastCanvasPath.length > 0
        ) {
            try {
                // Try to find the Canvas file
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
                        // Update the status bar with the loaded Canvas
                        this.updateStatusBar();
                        // Show a subtle notification that a Canvas was automatically selected
                        new Notice(`Canvas loaded: ${file.basename}`, 2000);
                    }
                } else {
                    // If the file no longer exists, clear the saved path
                    this.settings.lastCanvasPath = "";
                    await this.saveSettings();
                }
            } catch (error) {
                // Error loading Canvas file
                // Don't clear the path here, as it might be a temporary error
            }
        }
    }

    async saveSettings() {
        try {
            // Always save the current Canvas path if one is selected
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
            new Notice("No Canvas files found in vault");
            return;
        }

        const modal = new CanvasFileSuggestModal(
            this.app,
            canvasFiles,
            async (file: TFile) => {
                this.selectedCanvas = file;

                // Save the selected Canvas path to settings - ensure it's the full path
                this.settings.lastCanvasPath = file.path;

                await this.saveSettings();

                // Provide more context in the notification
                const persistenceInfo = this.settings.rememberLastCanvas
                    ? "This selection will be remembered across sessions."
                    : "This selection will be valid until you close Obsidian.";

                new Notice(
                    `Selected Canvas: ${file.basename}\n${persistenceInfo}`,
                );

                // Update the status bar
                this.updateStatusBar();

                // Log for debugging
            },
        );
        modal.open();
    }

    async sendSelectionToCanvas(editor: Editor, format: SendFormat) {
        // Check if a Canvas file is selected
        if (!this.selectedCanvas) {
            new Notice("Please select a Canvas file first");
            this.selectCanvasFile();
            return;
        }

        // Get the current file
        const currentView =
            this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!currentView) {
            new Notice("No active Markdown file");
            return;
        }

        const currentFile = currentView.file;
        if (!currentFile) {
            new Notice("Could not determine the current Markdown file");
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

        // We don't want to modify the content for the Canvas directly
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

                // If a block ID was successfully added, get the updated line content
                if (blockId) {
                    // Get the updated content directly from the editor
                    const updatedLine = editor.getLine(originalCursor.line);

                    // Extract the content without the block ID
                    contentToSend = updatedLine.replace(` ^${blockId}`, "");
                }
            }

            // Add the content to the Canvas
            await this.addToCanvas(format, contentToSend, currentFile, blockId);

            // Restore the original cursor position
            editor.setCursor(originalCursor);

            new Notice(
                `Selection sent to Canvas: ${this.selectedCanvas.basename}`,
            );
        } catch (error) {
            console.error("Error sending selection to Canvas:", error);
            new Notice("Error sending selection to Canvas");

            // Restore the cursor position even if there was an error
            editor.setCursor(originalCursor);
        }
    }

    async sendCurrentNoteToCanvas() {
        if (!this.selectedCanvas) {
            new Notice("Please select a Canvas file first");
            this.selectCanvasFile();
            return;
        }

        const currentView =
            this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!currentView) {
            new Notice("No active Markdown file");
            return;
        }

        const currentFile = currentView.file;
        if (!currentFile) {
            new Notice("Could not determine the current Markdown file");
            return;
        }

        try {
            await this.addNoteToCanvas(currentFile);
            new Notice(`Note sent to Canvas: ${this.selectedCanvas.basename}`);
        } catch (error) {
            new Notice(
                `Failed to send note to Canvas: ${error.message || "Unknown error"}`,
            );
        }
    }

    async sendNoteAsLinkToCanvas() {
        if (!this.selectedCanvas) {
            new Notice("Please select a Canvas file first");
            this.selectCanvasFile();
            return;
        }

        const currentView =
            this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!currentView) {
            new Notice("No active Markdown file");
            return;
        }

        const currentFile = currentView.file;
        if (!currentFile) {
            new Notice("Could not determine the current Markdown file");
            return;
        }

        try {
            await this.addNoteAsLinkToCanvas(currentFile);
            new Notice(
                `Note link sent to Canvas: ${this.selectedCanvas.basename}`,
            );
        } catch (error) {
            new Notice(
                `Failed to send note link to Canvas: ${
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
        // Filter for files with .canvas extension
        return files.filter((file) => file.extension === "canvas");
    }

    // Helper method to find a Canvas file by name or path
    findCanvasFile(nameOrPath: string): TFile | null {
        // First try to get by exact path - this is the most efficient method
        const fileByPath = this.app.vault.getAbstractFileByPath(nameOrPath);
        if (fileByPath instanceof TFile && fileByPath.extension === "canvas") {
            return fileByPath;
        }

        // If that fails, extract the filename and try to find by name
        const fileName = nameOrPath.split("/").pop() || nameOrPath;
        const baseNameWithoutExt = fileName.replace(/\.canvas$/, "");

        // Use getAbstractFileByPath with the inferred path - more efficient
        const exactNameFile = this.app.vault.getAbstractFileByPath(
            `${baseNameWithoutExt}.canvas`,
        );
        if (exactNameFile instanceof TFile) {
            return exactNameFile;
        }

        return null;
    }

    /**
     * Calculates a position for a new node based on existing nodes
     * @param nodes Existing nodes in the Canvas
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
     * Generates a unique ID for a Canvas node
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
            const lineContent = editor.getLine(originalCursor.line);

            // First, try to find the content in the editor
            let position: { line: number; offset: number } | null = null;

            // Check if the content is the current line
            if (content === lineContent) {
                position = {
                    line: originalCursor.line,
                    offset: 0,
                };
            } else {
                // Search through all lines in the editor
                for (let i = 0; i < editor.lineCount(); i++) {
                    const line = editor.getLine(i);
                    if (line.includes(content)) {
                        position = {
                            line: i,
                            offset: line.indexOf(content),
                        };
                        break;
                    }
                }

                // If not found, try with trimmed content
                if (!position) {
                    const trimmedContent = content.trim();
                    for (let i = 0; i < editor.lineCount(); i++) {
                        const line = editor.getLine(i);
                        if (line.trim() === trimmedContent) {
                            position = {
                                line: i,
                                offset: line.indexOf(trimmedContent.charAt(0)),
                            };
                            break;
                        }
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

                    // Use editor.setLine instead of modifying the file directly
                    editor.setLine(line, modifiedContent + ` ^${blockId}`);

                    // Restore cursor position
                    editor.setCursor(originalCursor);

                    return blockId;
                }

                return "";
            }

            // Check if the line already has a block ID
            const line = editor.getLine(position.line);

            // If the line already has a block ID, return it
            const existingIdMatch = line.match(/\^([a-zA-Z0-9-]+)$/);
            if (existingIdMatch) {
                return existingIdMatch[1];
            }

            // Generate a new block ID
            const blockId = BlockReferenceUtils.generateBlockId(this.settings);

            // Check if we need to append the task text configuration
            const modifiedLine = this.appendTextToOpenTask(line, true);
            if (this.debugMode) {
                console.log("Original line:", line);
                console.log(
                    "Modified line after task text append:",
                    modifiedLine,
                );
            }

            // Add the block ID to the line using editor.setLine
            editor.setLine(position.line, modifiedLine + ` ^${blockId}`);
            if (this.debugMode) {
                console.log(
                    "Final line with block ID:",
                    modifiedLine + ` ^${blockId}`,
                );
            }

            // Restore cursor position if needed
            if (position.line === originalCursor.line) {
                editor.setCursor(originalCursor);
            }

            return blockId;
        } catch (error) {
            if (this.debugMode) {
                console.error("Error adding block ID to selection:", error);
            }
            return "";
        }
    }

    async addToCanvas(
        format: SendFormat,
        content: string,
        sourceFile: TFile,
        blockId = "",
    ): Promise<void> {
        if (!this.selectedCanvas) {
            new Notice("No Canvas selected");
            return;
        }

        // Read the Canvas file
        let canvasContent: string;
        try {
            canvasContent = await this.app.vault.read(this.selectedCanvas);

            // Check if the Canvas content is empty or too short to be valid JSON
            if (!canvasContent || canvasContent.trim().length < 2) {
                // Initialize with empty Canvas structure
                canvasContent = JSON.stringify({ nodes: [], edges: [] });

                // Save the initialized structure to the file
                await this.app.vault.process(
                    this.selectedCanvas,
                    (data) => canvasContent,
                );
            }
        } catch (error) {
            if (this.debugMode) {
                console.error("Error reading Canvas file:", error);
            }
            new Notice(
                `Failed to read Canvas file: ${error.message || "Unknown error"}`,
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
            if (this.debugMode) {
                console.error("Error parsing Canvas file:", error);
            }
            new Notice(
                "Error parsing Canvas file. It may not be in the expected format.",
            );

            // Try to recover by creating a new Canvas structure
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
                                    await this.app.vault.process(
                                        sourceFile,
                                        (data) => lines.join("\n"),
                                    );
                                }
                                break;
                            }
                        }
                    } catch (error) {
                        if (this.debugMode) {
                            console.error(
                                "Error updating source file for block embed:",
                                error,
                            );
                        }
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
            // Don't modify the content for the Canvas, only for source files

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

        // Add the new node to the Canvas
        canvasData.nodes.push(newNode);

        // Save the modified Canvas
        try {
            await this.app.vault.process(this.selectedCanvas, (data) =>
                JSON.stringify(canvasData, null, 2),
            );
        } catch (error) {
            if (this.debugMode) {
                console.error("Error saving Canvas:", error);
            }
            new Notice(
                `Failed to save Canvas: ${error.message || "Unknown error"}`,
            );
        }
    }

    async addNoteToCanvas(noteFile: TFile) {
        if (!this.selectedCanvas) return;

        // Read the Canvas file
        let canvasContent: string;
        try {
            canvasContent = await this.app.vault.read(this.selectedCanvas);

            // Check if the Canvas content is empty or too short to be valid JSON
            if (!canvasContent || canvasContent.trim().length < 2) {
                // Initialize with empty Canvas structure
                canvasContent = JSON.stringify({ nodes: [], edges: [] });

                // Save the initialized structure to the file
                await this.app.vault.process(
                    this.selectedCanvas,
                    (data) => canvasContent,
                );
            }
        } catch (error) {
            if (this.debugMode) {
                console.error("Error reading Canvas file:", error);
            }
            new Notice(
                `Failed to read Canvas file: ${error.message || "Unknown error"}`,
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
            if (this.debugMode) {
                console.error("Error parsing Canvas file:", error);
            }
            new Notice(
                "Error parsing Canvas file. It may not be in the expected format.",
            );

            // Try to recover by creating a new Canvas structure
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

        // Add the new node to the Canvas
        canvasData.nodes.push(newNode);

        // Save the modified Canvas
        try {
            await this.app.vault.process(this.selectedCanvas, (data) =>
                JSON.stringify(canvasData, null, 2),
            );

            new Notice(`Note sent to Canvas: ${this.selectedCanvas.name}`);
        } catch (error) {
            if (this.debugMode) {
                console.error("Error saving Canvas:", error);
            }
            new Notice(
                `Failed to save Canvas: ${error.message || "Unknown error"}`,
            );
        }
    }

    async addNoteAsLinkToCanvas(noteFile: TFile) {
        if (!this.selectedCanvas) return;

        // Read the Canvas file
        let canvasContent: string;
        try {
            canvasContent = await this.app.vault.read(this.selectedCanvas);

            // Check if the Canvas content is empty or too short to be valid JSON
            if (!canvasContent || canvasContent.trim().length < 2) {
                // Initialize with empty Canvas structure
                canvasContent = JSON.stringify({ nodes: [], edges: [] });

                // Save the initialized structure to the file
                await this.app.vault.process(
                    this.selectedCanvas,
                    (data) => canvasContent,
                );
            }
        } catch (error) {
            if (this.debugMode) {
                console.error("Error reading Canvas file:", error);
            }
            new Notice(
                `Failed to read Canvas file: ${error.message || "Unknown error"}`,
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
            if (this.debugMode) {
                console.error("Error parsing Canvas file:", error);
            }
            new Notice(
                "Error parsing Canvas file. It may not be in the expected format.",
            );

            // Try to recover by creating a new Canvas structure
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

        // Add the new node to the Canvas
        canvasData.nodes.push(newNode);

        // Save the modified Canvas
        try {
            await this.app.vault.process(this.selectedCanvas, (data) =>
                JSON.stringify(canvasData, null, 2),
            );
        } catch (error) {
            if (this.debugMode) {
                console.error("Error saving Canvas:", error);
            }
            new Notice(
                `Failed to save Canvas: ${error.message || "Unknown error"}`,
            );
        }
    }

    /**
     * Truncates a filename to the specified maximum length,
     * adding an ellipsis if truncated
     * @param filename The filename to truncate
     * @param maxLength Maximum length before truncation
     * @returns Truncated filename
     */
    truncateFilename(filename: string, maxLength: number): string {
        if (filename.length <= maxLength) {
            return filename;
        }

        // Truncate and add ellipsis
        return filename.slice(0, maxLength) + "…";
    }

    updateStatusBar() {
        if (!this.statusBarItem) return;

        // Empty the element but don't remove the event listener
        this.statusBarItem.empty();

        if (this.selectedCanvas) {
            const truncatedName = this.truncateFilename(
                this.selectedCanvas.basename,
                this.settings.statusBarMaxFilenameLength,
            );

            this.statusBarItem.setText(`Canvas: ${truncatedName}`);
            this.statusBarItem.addClass("has-canvas-selected");
            this.statusBarItem.removeClass("no-canvas-selected");

            // Add tooltip with the full filename if truncated
            if (truncatedName !== this.selectedCanvas.basename) {
                this.statusBarItem.setAttribute(
                    "aria-label",
                    this.selectedCanvas.basename,
                );
            } else {
                this.statusBarItem.removeAttribute("aria-label");
            }
        } else {
            this.statusBarItem.setText("No Canvas selected");
            this.statusBarItem.addClass("no-canvas-selected");
            this.statusBarItem.removeClass("has-canvas-selected");
            this.statusBarItem.removeAttribute("aria-label");
        }
    }

    // Debug method to test Canvas file finding
    debugCanvasFinding() {
        // Log all Canvas files in the vault
        const allCanvasFiles = this.getCanvasFiles();

        // If we have a saved path, try to find it
        if (this.settings.lastCanvasPath) {
            const found = this.findCanvasFile(this.settings.lastCanvasPath);
        }

        // Show a notice with the number of Canvas files
        new Notice(
            `Found ${allCanvasFiles.length} Canvas files in vault. Check console for details.`,
        );
    }

    // Helper method to append text to open tasks if settings enabled
    // When modifySourceOnly is true, it only returns modified text for updating the source file
    // When modifySourceOnly is false, it modifies text for both source file and Canvas content
    appendTextToOpenTask(text: string, modifySourceOnly = false): string {
        if (
            !text ||
            !text.trim().startsWith("- [ ]") ||
            !this.settings.appendTextToOpenTasks
        ) {
            return text;
        }

        // If we're only supposed to modify the source file and this is for Canvas content, return unmodified
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

// Modal for selecting Canvas files
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
