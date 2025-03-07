import { Plugin, TFile, Notice, Menu, MenuItem, MarkdownView, Editor, SuggestModal, TextComponent, FuzzySuggestModal } from 'obsidian';
import { SettingsTab } from './settingsTab';
import { PluginSettings, DEFAULT_SETTINGS, SendFormat } from './settings';
import { BlockReferenceUtils } from './utils';

interface CanvasNode {
    id: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    url?: string;
    file?: string;
    text?: string;
}

interface CanvasData {
    nodes: CanvasNode[];
    edges: any[];
}

export default class SendToCanvasPlugin extends Plugin {
    settings: PluginSettings;
    selectedCanvas: TFile | null = null;

    async onload() {
        await this.loadSettings();

        // Add settings tab
        this.addSettingTab(new SettingsTab(this.app, this));

        // Add command to select a canvas file
        this.addCommand({
            id: 'select-canvas-file',
            name: 'Select a canvas file',
            callback: () => {
                this.selectCanvasFile();
            }
        });

        // Add command to send selection to canvas as plain text
        this.addCommand({
            id: 'send-selection-to-canvas-as-plain-text',
            name: 'Send selection to canvas as plain text',
            editorCallback: (editor: Editor) => {
                this.sendSelectionToCanvas(editor, 'plain');
            }
        });

        // Add command to send selection to canvas as block link
        this.addCommand({
            id: 'send-selection-to-canvas-as-block-link',
            name: 'Send selection to canvas as block link',
            editorCallback: (editor: Editor) => {
                this.sendSelectionToCanvas(editor, 'link');
            }
        });

        // Add command to send selection to canvas as block embed
        this.addCommand({
            id: 'send-selection-to-canvas-as-block-embed',
            name: 'Send selection to canvas as block embed',
            editorCallback: (editor: Editor) => {
                this.sendSelectionToCanvas(editor, 'embed');
            }
        });

        // Add command to send the current note to canvas
        this.addCommand({
            id: 'send-current-note-to-canvas',
            name: 'Send current note to canvas',
            callback: () => {
                this.sendCurrentNoteToCanvas();
            }
        });

        // Add context menu for editor
        this.registerEvent(
            this.app.workspace.on('editor-menu', (menu: Menu, editor: Editor) => {
                const selection = editor.getSelection();
                if (selection) {
                    menu.addItem((item: MenuItem) => {
                        item.setTitle('Send to canvas')
                            .setIcon('document')
                            .onClick(() => {
                                this.showSendMenu(editor);
                            });
                    });
                }
            })
        );
    }

    onunload() {
        // Cleanup when the plugin is disabled
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
        
        // If remember last canvas is enabled and there's a saved path, try to load it
        if (this.settings.rememberLastCanvas && this.settings.lastCanvasPath) {
            const file = this.app.vault.getAbstractFileByPath(this.settings.lastCanvasPath);
            if (file instanceof TFile && file.extension === 'canvas') {
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
            new Notice('No canvas files found in vault');
            return;
        }

        const modal = new CanvasFileSuggestModal(this.app, canvasFiles, (file: TFile) => {
            this.selectedCanvas = file;
            this.settings.lastCanvasPath = file.path;
            this.saveSettings();
            new Notice(`Selected canvas: ${file.name}`);
        });
        modal.open();
    }

    async sendSelectionToCanvas(editor: Editor, format: SendFormat) {
        if (!this.selectedCanvas) {
            new Notice('Please select a canvas file first');
            this.selectCanvasFile();
            return;
        }

        const selection = editor.getSelection();
        if (!selection) {
            new Notice('No text selected');
            return;
        }

        const currentView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!currentView) {
            new Notice('No active markdown file');
            return;
        }

        const currentFile = currentView.file;
        const currentContent = selection;
        let contentToSend = currentContent;

        // Process content based on settings
        if (this.settings.includeTagsInSend) {
            // Extract tags if any in the selection
            const tags = BlockReferenceUtils.extractTags(currentContent);
            if (tags && tags.length > 0) {
                contentToSend += `\n\nTags: ${tags.join(', ')}`;
            }
        }

        if (this.settings.includeTaskPropertiesInSend && currentContent.includes('- [ ]')) {
            // Process task properties
            contentToSend = BlockReferenceUtils.processTaskProperties(contentToSend);
        }

        // Create block reference for link and embed formats
        let blockId = '';
        if (format === 'link' || format === 'embed') {
            blockId = await this.createBlockReference(currentFile, selection);
            if (!blockId) {
                new Notice('Failed to create block reference');
                return;
            }
        }

        try {
            await this.addToCanvas(format, contentToSend, currentFile, blockId);
            new Notice(`Content sent to canvas: ${this.selectedCanvas.name}`);
        } catch (error) {
            console.error('Error sending to canvas:', error);
            new Notice('Failed to send content to canvas');
        }
    }

    async sendCurrentNoteToCanvas() {
        if (!this.selectedCanvas) {
            new Notice('Please select a canvas file first');
            this.selectCanvasFile();
            return;
        }

        const currentView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!currentView) {
            new Notice('No active markdown file');
            return;
        }

        const currentFile = currentView.file;

        try {
            await this.addNoteToCanvas(currentFile);
            new Notice(`Note sent to canvas: ${this.selectedCanvas.name}`);
        } catch (error) {
            console.error('Error sending note to canvas:', error);
            new Notice('Failed to send note to canvas');
        }
    }

    showSendMenu(editor: Editor) {
        const menu = new Menu();

        menu.addItem((item) => {
            item.setTitle('Send as plain text')
                .onClick(() => {
                    this.sendSelectionToCanvas(editor, 'plain');
                });
        });

        menu.addItem((item) => {
            item.setTitle('Send as block link')
                .onClick(() => {
                    this.sendSelectionToCanvas(editor, 'link');
                });
        });

        menu.addItem((item) => {
            item.setTitle('Send as block embed')
                .onClick(() => {
                    this.sendSelectionToCanvas(editor, 'embed');
                });
        });

        menu.showAtMouseEvent(editor.getCursor());
    }

    getCanvasFiles(): TFile[] {
        return this.app.vault.getFiles().filter(file => file.extension === 'canvas');
    }

    async createBlockReference(file: TFile, selectedText: string): Promise<string> {
        return BlockReferenceUtils.createBlockReference(this.app.vault, file, selectedText);
    }

    generateBlockId(): string {
        return BlockReferenceUtils.generateBlockId();
    }

    async addToCanvas(format: SendFormat, content: string, sourceFile: TFile, blockId: string = '') {
        if (!this.selectedCanvas) return;

        // Read the canvas file
        const canvasContent = await this.app.vault.read(this.selectedCanvas);
        const canvasData: CanvasData = JSON.parse(canvasContent);

        // Determine the position for the new node
        // For simplicity, we're placing it at a fixed offset from the origin
        const newNodePosition = this.calculateNewNodePosition(canvasData.nodes);

        // Create the new node based on the format
        const newNode: CanvasNode = {
            id: this.generateNodeId(),
            type: 'text',
            x: newNodePosition.x,
            y: newNodePosition.y,
            width: 400,
            height: 200
        };

        if (format === 'plain') {
            newNode.text = content;
        } else if (format === 'link') {
            newNode.text = `[[${sourceFile.path}#^${blockId}|${content.split('\n')[0]}]]`;
        } else if (format === 'embed') {
            newNode.text = `![[${sourceFile.path}#^${blockId}]]`;
        }

        // Add the new node to the canvas
        canvasData.nodes.push(newNode);

        // Save the modified canvas
        await this.app.vault.modify(this.selectedCanvas, JSON.stringify(canvasData, null, 2));
    }

    async addNoteToCanvas(noteFile: TFile) {
        if (!this.selectedCanvas) return;

        // Read the canvas file
        const canvasContent = await this.app.vault.read(this.selectedCanvas);
        const canvasData: CanvasData = JSON.parse(canvasContent);

        // Determine the position for the new node
        const newNodePosition = this.calculateNewNodePosition(canvasData.nodes);

        // Create a new file node
        const newNode: CanvasNode = {
            id: this.generateNodeId(),
            type: 'file',
            file: noteFile.path,
            x: newNodePosition.x,
            y: newNodePosition.y,
            width: 400,
            height: 400
        };

        // Add the new node to the canvas
        canvasData.nodes.push(newNode);

        // Save the modified canvas
        await this.app.vault.modify(this.selectedCanvas, JSON.stringify(canvasData, null, 2));
    }

    calculateNewNodePosition(existingNodes: CanvasNode[]) {
        // Default position if no nodes exist
        if (!existingNodes.length) {
            return { x: 0, y: 0 };
        }

        // Find the rightmost node
        let maxX = Math.max(...existingNodes.map(node => node.x + node.width));
        
        // Position the new node to the right with some padding
        return { x: maxX + 50, y: 0 };
    }

    generateNodeId(): string {
        // Generate a random node ID for canvas
        return Date.now().toString() + Math.random().toString(36).substring(2, 9);
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
